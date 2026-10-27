// HU05 — Modificar un pedido activo
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
const ids = {};
let chumblun; // { id, precio }
let batea;
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    ids[rol] = await crearCuenta(`modificar.${rol}`, rol);
    t[rol] = await tokenDe(`modificar.${rol}`);
  }
  ids.mesero2 = await crearCuenta('modificar.mesero2', 'mesero');
  t.mesero2 = await tokenDe('modificar.mesero2');
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  [[batea]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Batea'");
});

beforeEach(async () => {
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('UPDATE mesa SET activa = FALSE');
  await pool.query('UPDATE producto SET activo = TRUE, agotado_hoy = FALSE');
  await pool.query('UPDATE categoria SET activa = TRUE');
});

const como = (quien) => {
  const conToken = (r) => (t[quien] ? r.set('Authorization', `Bearer ${t[quien]}`) : r);
  return {
    get: (url) => conToken(request(app).get(url)),
    post: (url, datos) => conToken(request(app).post(url)).send(datos),
    put: (url, datos) => conToken(request(app).put(url)).send(datos),
    delete: (url, datos) => conToken(request(app).delete(url)).send(datos),
  };
};

let contadorMesas = 0;
// Abre una mesa con 2 Chumblún "sin cebolla" y 1 Batea. Devuelve el pedido.
async function pedidoAbierto(quien = 'mesero') {
  contadorMesas += 1;
  const mesa = await como(quien).post('/api/mesas', { nombre: `Mesa ${contadorMesas}` });
  const res = await como(quien).post('/api/pedidos', {
    mesaId: mesa.body.id,
    items: [
      { productoId: chumblun.id, cantidad: 2, nota: 'sin cebolla' },
      { productoId: batea.id, cantidad: 1 },
    ],
  });
  return res.body;
}

const lineaDe = (pedido, nombre) => pedido.items.find((i) => i.nombre === nombre);

async function ajustes(pedidoId) {
  const [filas] = await pool.query(
    "SELECT contenido, solicitado_por FROM trabajo_impresion WHERE pedido_id = ? AND tipo = 'ajuste_comanda' ORDER BY id",
    [pedidoId],
  );
  return filas;
}

describe('Agregar productos a un pedido abierto', () => {
  it('suma a la línea igual, recalcula el total y manda a cocina solo la adición', async () => {
    const pedido = await pedidoAbierto();
    const res = await como('mesero2').post(`/api/pedidos/${pedido.id}/items`, {
      items: [
        { productoId: chumblun.id, cantidad: 1, nota: 'Sin cebolla' },
        { productoId: batea.id, cantidad: 2, nota: 'para llevar' },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.items.map((i) => [i.nombre, i.cantidad, i.nota])).toEqual([
      ['Chumblún', 3, 'sin cebolla'],
      ['Batea', 1, null],
      ['Batea', 2, 'para llevar'],
    ]);
    expect(res.body.subtotal).toBe(chumblun.precio * 3 + batea.precio * 3);

    const [trabajo] = await ajustes(pedido.id);
    expect(trabajo.solicitado_por).toBe(ids.mesero2);
    expect(trabajo.contenido).toContain('*** ADICIÓN ***');
    expect(trabajo.contenido).toContain('+ 1 x Chumblún');
    expect(trabajo.contenido).toContain('+ 2 x Batea');
    expect(trabajo.contenido).toContain('* para llevar');
    expect(trabajo.contenido).toContain('Por: Prueba modificar.mesero2');
    expect(trabajo.contenido).not.toContain('2 x Chumblún');
    for (const l of trabajo.contenido.split('\n')) expect(l.length).toBeLessThanOrEqual(32);
    expect(res.body.ajuste).toBe(trabajo.contenido);
  });

  it('la mesa muestra el total nuevo', async () => {
    const pedido = await pedidoAbierto();
    await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.pedido.total).toBe(chumblun.precio * 2 + batea.precio * 2);
  });

  it('si el precio cambió en la carta, lo nuevo va en otra línea con el precio nuevo', async () => {
    const pedido = await pedidoAbierto();
    await pool.query('UPDATE producto SET precio = precio + 2000 WHERE id = ?', [batea.id]);
    try {
      const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
        items: [{ productoId: batea.id, cantidad: 1 }],
      });
      const bateas = res.body.items.filter((i) => i.nombre === 'Batea');
      expect(bateas.map((b) => b.precio_unitario)).toEqual([batea.precio, batea.precio + 2000]);
      expect(res.body.subtotal).toBe(chumblun.precio * 2 + batea.precio * 2 + 2000);
    } finally {
      await pool.query('UPDATE producto SET precio = precio - 2000 WHERE id = ?', [batea.id]);
    }
  });

  it('no deja agregar un producto agotado, y no cambia nada (409)', async () => {
    const pedido = await pedidoAbierto();
    await pool.query('UPDATE producto SET agotado_hoy = TRUE WHERE id = ?', [batea.id]);
    const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [
        { productoId: chumblun.id, cantidad: 1 },
        { productoId: batea.id, cantidad: 1 },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('"Batea" está agotado hoy.');
    const actual = (await como('mesero').get(`/api/pedidos/${pedido.id}`)).body;
    expect(actual.subtotal).toBe(pedido.subtotal);
    expect(await ajustes(pedido.id)).toHaveLength(0);
  });

  it('no pasa de 99 unidades en una línea (400)', async () => {
    const pedido = await pedidoAbierto();
    const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [{ productoId: batea.id, cantidad: 99 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/más de 99/);
  });

  it.each([[[]], [[{ productoId: 1, cantidad: 0 }]], [[{ productoId: 'x', cantidad: 1 }]]])(
    'rechaza una adición inválida %j (400)',
    async (items) => {
      const pedido = await pedidoAbierto();
      const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, { items });
      expect(res.status).toBe(400);
    },
  );
});

describe('Cambiar la cantidad o la nota', () => {
  it('bajar la cantidad sin motivo falla (400) y no cambia nada', async () => {
    const pedido = await pedidoAbierto();
    const linea = lineaDe(pedido, 'Chumblún');
    const res = await como('mesero').put(`/api/pedidos/${pedido.id}/items/${linea.id}`, {
      cantidad: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/);
    const actual = (await como('mesero').get(`/api/pedidos/${pedido.id}`)).body;
    expect(lineaDe(actual, 'Chumblún').cantidad).toBe(2);
  });

  it('con motivo baja la cantidad, avisa a cocina y queda en el historial', async () => {
    const pedido = await pedidoAbierto();
    const linea = lineaDe(pedido, 'Chumblún');
    const res = await como('mesero').put(`/api/pedidos/${pedido.id}/items/${linea.id}`, {
      cantidad: 1,
      motivo: 'El cliente cambió de opinión',
    });
    expect(res.status).toBe(200);
    expect(lineaDe(res.body, 'Chumblún').cantidad).toBe(1);
    expect(res.body.subtotal).toBe(chumblun.precio + batea.precio);
    expect(res.body.ajuste).toContain('*** ANULAR ***');
    expect(res.body.ajuste).toContain('- 1 x Chumblún');
    expect(res.body.ajuste).toContain('Quedan 1');
    expect(res.body.ajuste).toContain('MOTIVO: El cliente cambió de');

    const cambio = res.body.historial.find((h) => h.accion === 'cambiar_item');
    expect(cambio).toMatchObject({
      valor_anterior: '2 x Chumblún (sin cebolla)',
      valor_nuevo: '1 x Chumblún (sin cebolla)',
      motivo: 'El cliente cambió de opinión',
      usuario: 'Prueba modificar.mesero',
    });
    expect(cambio.creado_en).toBeTruthy();
  });

  it('subir la cantidad no pide motivo', async () => {
    const pedido = await pedidoAbierto();
    const linea = lineaDe(pedido, 'Batea');
    const res = await como('mesero').put(`/api/pedidos/${pedido.id}/items/${linea.id}`, {
      cantidad: 3,
    });
    expect(res.status).toBe(200);
    expect(res.body.ajuste).toContain('+ 2 x Batea');
  });

  it('cambiar la nota avisa a cocina lo de antes y lo de ahora', async () => {
    const pedido = await pedidoAbierto();
    const linea = lineaDe(pedido, 'Chumblún');
    const res = await como('mesero').put(`/api/pedidos/${pedido.id}/items/${linea.id}`, {
      nota: 'con todo',
    });
    expect(res.status).toBe(200);
    expect(lineaDe(res.body, 'Chumblún').nota).toBe('con todo');
    expect(res.body.ajuste).toContain('*** CAMBIO ***');
    expect(res.body.ajuste).toContain('* antes: sin cebolla');
    expect(res.body.ajuste).toContain('* ahora: con todo');
  });

  it('si no cambia nada, no manda nada a cocina', async () => {
    const pedido = await pedidoAbierto();
    const linea = lineaDe(pedido, 'Batea');
    const res = await como('mesero').put(`/api/pedidos/${pedido.id}/items/${linea.id}`, {
      cantidad: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.ajuste).toBeNull();
    expect(await ajustes(pedido.id)).toHaveLength(0);
  });

  it('sin cantidad ni nota, o con datos fuera de rango, responde 400', async () => {
    const pedido = await pedidoAbierto();
    const url = `/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Batea').id}`;
    expect((await como('mesero').put(url, {})).status).toBe(400);
    expect((await como('mesero').put(url, { cantidad: 0 })).status).toBe(400);
    expect((await como('mesero').put(url, { cantidad: 100 })).status).toBe(400);
    expect((await como('mesero').put(url, { nota: 'x'.repeat(121) })).status).toBe(400);
  });

  it('una línea de otro pedido responde 404', async () => {
    const a = await pedidoAbierto();
    const b = await pedidoAbierto();
    const res = await como('mesero').put(`/api/pedidos/${a.id}/items/${b.items[0].id}`, {
      cantidad: 5,
    });
    expect(res.status).toBe(404);
  });
});

describe('Quitar un producto', () => {
  it('sin motivo falla (400)', async () => {
    const pedido = await pedidoAbierto();
    const url = `/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Batea').id}`;
    expect((await como('mesero').delete(url)).status).toBe(400);
    const res = await como('mesero').delete(url, { motivo: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/);
  });

  it('con motivo lo quita, recalcula y avisa a cocina', async () => {
    const pedido = await pedidoAbierto();
    const res = await como('mesero').delete(
      `/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Batea').id}`,
      { motivo: 'Se demoró mucho' },
    );
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('abierto');
    expect(res.body.items.map((i) => i.nombre)).toEqual(['Chumblún']);
    expect(res.body.subtotal).toBe(chumblun.precio * 2);
    expect(res.body.ajuste).toContain('*** ANULAR ***');
    expect(res.body.ajuste).toContain('- 1 x Batea');
    expect(res.body.historial.at(-1)).toMatchObject({
      accion: 'quitar_item',
      valor_anterior: '1 x Batea',
      motivo: 'Se demoró mucho',
    });
  });

  it('quitar el único producto anula el pedido y deja la mesa libre', async () => {
    const pedido = await pedidoAbierto();
    const url = (i) => `/api/pedidos/${pedido.id}/items/${i.id}`;
    await como('mesero').delete(url(lineaDe(pedido, 'Batea')), { motivo: 'No quiso' });
    const res = await como('mesero').delete(url(lineaDe(pedido, 'Chumblún')), {
      motivo: 'El cliente se fue sin consumir',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'cancelado', subtotal: 0, items: [] });
    expect(res.body.cerrado_en).toBeTruthy();
    expect(res.body.ajuste).toContain('*** PEDIDO ANULADO ***');
    expect(res.body.historial.at(-1)).toMatchObject({
      accion: 'anular',
      motivo: 'El cliente se fue sin consumir',
    });

    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa).toMatchObject({ estado: 'libre', pedido: null });
    // La mesa se puede volver a usar
    const nuevo = await como('mesero').post('/api/pedidos', {
      mesaId: mesa.id,
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(nuevo.status).toBe(201);
  });
});

describe('Criterio de aceptación: un pedido cerrado no admite cambios', () => {
  it.each([
    ['por_cobrar', /ya tiene la cuenta generada/],
    ['pagado', /ya fue pagado/],
  ])('pedido en %s responde 409 para agregar, cambiar y quitar', async (estado, mensaje) => {
    const pedido = await pedidoAbierto();
    await pool.query('UPDATE pedido SET estado = ? WHERE id = ?', [estado, pedido.id]);
    const linea = `/api/pedidos/${pedido.id}/items/${pedido.items[0].id}`;
    const respuestas = [
      await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
        items: [{ productoId: batea.id, cantidad: 1 }],
      }),
      await como('mesero').put(linea, { cantidad: 5 }),
      await como('mesero').delete(linea, { motivo: 'Prueba' }),
    ];
    for (const r of respuestas) {
      expect(r.status).toBe(409);
      expect(r.body.error).toMatch(mensaje);
    }
    expect(await ajustes(pedido.id)).toHaveLength(0);
  });

  it('un pedido anulado tampoco admite cambios', async () => {
    const pedido = await pedidoAbierto();
    for (const i of pedido.items) {
      await como('mesero').delete(`/api/pedidos/${pedido.id}/items/${i.id}`, { motivo: 'Se fue' });
    }
    const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/fue anulado/);
  });

  it('un pedido que no existe responde 404', async () => {
    const res = await como('mesero').post('/api/pedidos/999999/items', {
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(res.status).toBe(404);
  });
});

describe('Permisos', () => {
  it('el propietario también modifica; el cajero no (403) y sin sesión 401', async () => {
    const pedido = await pedidoAbierto();
    const adicion = { items: [{ productoId: batea.id, cantidad: 1 }] };
    const url = `/api/pedidos/${pedido.id}/items`;
    const linea = `${url}/${pedido.items[0].id}`;
    expect((await como('propietario').post(url, adicion)).status).toBe(200);
    expect((await como('cajero').post(url, adicion)).status).toBe(403);
    expect((await como('cajero').put(linea, { cantidad: 5 })).status).toBe(403);
    expect((await como('cajero').delete(linea, { motivo: 'Prueba' })).status).toBe(403);
    expect((await como('nadie').post(url, adicion)).status).toBe(401);
  });
});

describe('Cambios simultáneos desde dos celulares', () => {
  it('dos adiciones al mismo tiempo: no se pierde ninguna', async () => {
    const pedido = await pedidoAbierto();
    const url = `/api/pedidos/${pedido.id}/items`;
    const [a, b] = await Promise.all([
      como('mesero').post(url, { items: [{ productoId: batea.id, cantidad: 1 }] }),
      como('mesero2').post(url, { items: [{ productoId: batea.id, cantidad: 2 }] }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const final = (await como('mesero').get(`/api/pedidos/${pedido.id}`)).body;
    expect(lineaDe(final, 'Batea').cantidad).toBe(4);
    expect(final.subtotal).toBe(chumblun.precio * 2 + batea.precio * 4);
    expect(await ajustes(pedido.id)).toHaveLength(2);
  });

  it('dos celulares quitan el mismo producto a la vez: uno lo quita y el otro recibe 404', async () => {
    const pedido = await pedidoAbierto();
    const url = `/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Batea').id}`;
    const [a, b] = await Promise.all([
      como('mesero').delete(url, { motivo: 'Repetido' }),
      como('mesero2').delete(url, { motivo: 'Repetido' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 404]);
    expect(await ajustes(pedido.id)).toHaveLength(1);
  });

  it('mientras un celular quita el último producto, el otro no puede agregar a un pedido anulado', async () => {
    const pedido = await pedidoAbierto();
    await como('mesero').delete(`/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Batea').id}`, {
      motivo: 'No quiso',
    });
    const [a, b] = await Promise.all([
      como('mesero').delete(`/api/pedidos/${pedido.id}/items/${lineaDe(pedido, 'Chumblún').id}`, {
        motivo: 'Se fue',
      }),
      como('mesero2').post(`/api/pedidos/${pedido.id}/items`, {
        items: [{ productoId: batea.id, cantidad: 1 }],
      }),
    ]);
    const final = (await como('mesero').get(`/api/pedidos/${pedido.id}`)).body;
    if (final.estado === 'cancelado') {
      // Se anuló primero: la adición llegó tarde
      expect(a.status).toBe(200);
      expect(b.status).toBe(409);
    } else {
      // La adición entró primero: el pedido sigue con la Batea nueva
      expect(b.status).toBe(200);
      expect(final.items.map((i) => i.nombre)).toEqual(['Batea']);
    }
  });
});
