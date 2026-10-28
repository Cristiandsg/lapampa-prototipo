// HU06 — Cerrar el pedido y generar la cuenta
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
const ids = {};
let chumblun; // { id, precio }
let batea;
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    ids[rol] = await crearCuenta(`cerrar.${rol}`, rol);
    t[rol] = await tokenDe(`cerrar.${rol}`);
  }
  await crearCuenta('cerrar.mesero2', 'mesero');
  t.mesero2 = await tokenDe('cerrar.mesero2');
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  [[batea]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Batea'");
});

beforeEach(async () => {
  await pool.query('DELETE FROM pago');
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('UPDATE mesa SET activa = FALSE');
  await pool.query('UPDATE producto SET activo = TRUE, agotado_hoy = FALSE');
});

const como = (quien) => {
  const conToken = (r) => (t[quien] ? r.set('Authorization', `Bearer ${t[quien]}`) : r);
  return {
    get: (url) => conToken(request(app).get(url)),
    post: (url, datos) => conToken(request(app).post(url)).send(datos),
    put: (url, datos) => conToken(request(app).put(url)).send(datos),
    patch: (url, datos) => conToken(request(app).patch(url)).send(datos),
    delete: (url, datos) => conToken(request(app).delete(url)).send(datos),
  };
};

let contador = 0;
// Mesa con 2 Chumblún y 1 Batea
async function pedidoAbierto() {
  contador += 1;
  const mesa = await como('mesero').post('/api/mesas', { nombre: `Mesa ${contador}` });
  const res = await como('mesero').post('/api/pedidos', {
    mesaId: mesa.body.id,
    items: [
      { productoId: chumblun.id, cantidad: 2 },
      { productoId: batea.id, cantidad: 1 },
    ],
  });
  return res.body;
}

const cerrar = (pedidoId, quien = 'mesero') => como(quien).patch(`/api/pedidos/${pedidoId}/cerrar`);

describe('Cerrar el pedido y generar la cuenta', () => {
  it('el pedido y la mesa pasan a "por cobrar" y la cuenta va a la impresora de caja', async () => {
    const pedido = await pedidoAbierto();
    const res = await cerrar(pedido.id);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('por_cobrar');
    expect(res.body.cerrado_en).toBeTruthy();

    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.estado).toBe('por_cobrar');
    expect(mesa.pedido.id).toBe(pedido.id);

    const [[trabajo]] = await pool.query(
      "SELECT impresora, contenido, solicitado_por FROM trabajo_impresion WHERE pedido_id = ? AND tipo = 'cuenta'",
      [pedido.id],
    );
    expect(trabajo.impresora).toBe('caja');
    expect(trabajo.solicitado_por).toBe(ids.mesero);
    expect(trabajo.contenido).toBe(res.body.cuenta);
  });

  it('la cuenta trae el detalle, el total y la propina voluntaria aparte; nunca dice "factura" como título', async () => {
    const pedido = await pedidoAbierto();
    const { body } = await cerrar(pedido.id);
    const total = chumblun.precio * 2 + batea.precio;
    const pesos = (v) => `$${v.toLocaleString('es-CO')}`;

    expect(body.cuenta).toContain('CUENTA');
    expect(body.cuenta).toContain(`MESA: ${body.mesa}`);
    expect(body.cuenta).toContain(`Pedido #${pedido.id}`);
    expect(body.cuenta).toMatch(new RegExp(`2 x Chumblún +\\${pesos(chumblun.precio * 2)}`));
    expect(body.cuenta).toContain(`${pesos(chumblun.precio)} c/u`);
    expect(body.cuenta).toMatch(new RegExp(`TOTAL +\\${pesos(total)}`));
    expect(body.propina_sugerida).toBe(total / 10);
    expect(body.cuenta).toMatch(new RegExp(`Propina sugerida \\(10 %\\) +\\${pesos(total / 10)}`));
    expect(body.cuenta).toContain('voluntaria');
    expect(body.cuenta).toContain('Este documento no es factura.');
    expect(body.subtotal).toBe(total); // la propina no se suma
    for (const l of body.cuenta.split('\n')) expect(l.length).toBeLessThanOrEqual(32);
  });

  it('el total coincide con el detalle, incluidos los productos modificados (HU05)', async () => {
    const pedido = await pedidoAbierto();
    const url = `/api/pedidos/${pedido.id}/items`;
    await como('mesero').post(url, { items: [{ productoId: batea.id, cantidad: 2 }] });
    const chumblunLinea = pedido.items.find((i) => i.nombre === 'Chumblún');
    await como('mesero').put(`${url}/${chumblunLinea.id}`, { cantidad: 1, motivo: 'No quiso' });

    const { body } = await cerrar(pedido.id);
    const suma = body.items.reduce((s, i) => s + i.precio_unitario * i.cantidad, 0);
    expect(body.subtotal).toBe(suma);
    expect(body.subtotal).toBe(chumblun.precio + batea.precio * 3);
    expect(body.cuenta).toContain('3 x Batea');
    expect(body.cuenta).toContain('1 x Chumblún');
  });

  it('aparece en la bandeja del cajero con mesa, mesero y total', async () => {
    const a = await pedidoAbierto();
    const b = await pedidoAbierto();
    await pedidoAbierto(); // abierto: no aparece
    await cerrar(a.id);
    await cerrar(b.id, 'cajero');

    const res = await como('cajero').get('/api/caja/por-cobrar');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.id)).toEqual([a.id, b.id]);
    expect(res.body[0]).toMatchObject({
      mesa: a.mesa,
      mesero: 'Prueba cerrar.mesero',
      subtotal: chumblun.precio * 2 + batea.precio,
      productos: 3,
      minutos: expect.any(Number),
    });
  });

  it('queda en el historial quién generó la cuenta', async () => {
    const pedido = await pedidoAbierto();
    const { body } = await cerrar(pedido.id, 'cajero');
    expect(body.historial.at(-1)).toMatchObject({
      accion: 'cerrar',
      valor_anterior: 'abierto',
      usuario: 'Prueba cerrar.cajero',
    });
  });

  it('en un pedido abierto, GET trae la vista previa de la cuenta', async () => {
    const pedido = await pedidoAbierto();
    const res = await como('mesero').get(`/api/pedidos/${pedido.id}`);
    expect(res.body.estado).toBe('abierto');
    expect(res.body.cuenta).toContain('CUENTA');
    expect(res.body.cuenta).toContain('TOTAL');
  });
});

describe('Después de generar la cuenta', () => {
  it('el pedido ya no admite cambios (409)', async () => {
    const pedido = await pedidoAbierto();
    await cerrar(pedido.id);
    const res = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya tiene la cuenta generada/);
  });

  it('generarla dos veces responde 409 y no imprime otra cuenta', async () => {
    const pedido = await pedidoAbierto();
    await cerrar(pedido.id);
    const res = await cerrar(pedido.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no se puede generar la cuenta otra vez/);
    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM trabajo_impresion WHERE pedido_id = ? AND tipo = 'cuenta'",
      [pedido.id],
    );
    expect(n).toBe(1);
  });

  it('un pedido anulado no genera cuenta (409)', async () => {
    const pedido = await pedidoAbierto();
    for (const i of pedido.items) {
      await como('mesero').delete(`/api/pedidos/${pedido.id}/items/${i.id}`, { motivo: 'Se fue' });
    }
    const res = await cerrar(pedido.id);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/fue anulado/);
  });

  it('un pedido que no existe responde 404', async () => {
    expect((await cerrar(999999)).status).toBe(404);
  });
});

describe('Reabrir el pedido (el cliente pidió algo más)', () => {
  it('con motivo vuelve a "abierto", la mesa a "ocupada" y sale de la bandeja del cajero', async () => {
    const pedido = await pedidoAbierto();
    await cerrar(pedido.id);
    const res = await como('mesero').patch(`/api/pedidos/${pedido.id}/reabrir`, {
      motivo: 'El cliente pidió otra cerveza',
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('abierto');
    expect(res.body.cerrado_en).toBeNull();
    expect(res.body.historial.at(-1)).toMatchObject({
      accion: 'reabrir',
      motivo: 'El cliente pidió otra cerveza',
    });
    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.estado).toBe('ocupada');
    expect((await como('cajero').get('/api/caja/por-cobrar')).body).toEqual([]);

    // Ya se le puede agregar y volver a cerrar
    const mas = await como('mesero').post(`/api/pedidos/${pedido.id}/items`, {
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(mas.status).toBe(200);
    expect((await cerrar(pedido.id)).body.subtotal).toBe(chumblun.precio * 2 + batea.precio * 2);
  });

  it('sin motivo falla (400)', async () => {
    const pedido = await pedidoAbierto();
    await cerrar(pedido.id);
    const res = await como('mesero').patch(`/api/pedidos/${pedido.id}/reabrir`, {});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/motivo/);
  });

  it('un pedido abierto no se reabre (409)', async () => {
    const pedido = await pedidoAbierto();
    const res = await como('mesero').patch(`/api/pedidos/${pedido.id}/reabrir`, {
      motivo: 'Prueba',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/sigue abierto: no se puede reabrir/);
  });

  it('con pagos registrados ya no se reabre (409)', async () => {
    const pedido = await pedidoAbierto();
    await cerrar(pedido.id);
    await pool.query(
      "INSERT INTO pago (pedido_id, medio, valor, cajero_id) VALUES (?, 'efectivo', 10000, ?)",
      [pedido.id, ids.cajero],
    );
    const res = await como('cajero').patch(`/api/pedidos/${pedido.id}/reabrir`, {
      motivo: 'Prueba',
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya tiene pagos registrados/);
  });
});

describe('Permisos y concurrencia', () => {
  it('mesero, cajero y propietario generan la cuenta; sin sesión 401', async () => {
    for (const quien of ['mesero', 'cajero', 'propietario']) {
      const pedido = await pedidoAbierto();
      expect((await cerrar(pedido.id, quien)).status).toBe(200);
    }
    const pedido = await pedidoAbierto();
    expect((await cerrar(pedido.id, 'nadie')).status).toBe(401);
  });

  it('la bandeja de caja es del cajero y del propietario: el mesero recibe 403', async () => {
    expect((await como('cajero').get('/api/caja/por-cobrar')).status).toBe(200);
    expect((await como('propietario').get('/api/caja/por-cobrar')).status).toBe(200);
    expect((await como('mesero').get('/api/caja/por-cobrar')).status).toBe(403);
    expect((await como('nadie').get('/api/caja/por-cobrar')).status).toBe(401);
  });

  it('dos celulares generan la cuenta a la vez: una sola cuenta', async () => {
    const pedido = await pedidoAbierto();
    const [a, b] = await Promise.all([cerrar(pedido.id, 'mesero'), cerrar(pedido.id, 'mesero2')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const [[{ n }]] = await pool.query(
      "SELECT COUNT(*) AS n FROM trabajo_impresion WHERE pedido_id = ? AND tipo = 'cuenta'",
      [pedido.id],
    );
    expect(n).toBe(1);
  });

  it('mientras uno genera la cuenta, otro agrega: o entra la adición en la cuenta o recibe 409', async () => {
    const pedido = await pedidoAbierto();
    const [cierre, adicion] = await Promise.all([
      cerrar(pedido.id),
      como('mesero2').post(`/api/pedidos/${pedido.id}/items`, {
        items: [{ productoId: batea.id, cantidad: 1 }],
      }),
    ]);
    expect(cierre.status).toBe(200);
    const final = (await como('mesero').get(`/api/pedidos/${pedido.id}`)).body;
    if (adicion.status === 200) {
      // La adición entró primero: la cuenta ya la incluye
      expect(final.subtotal).toBe(chumblun.precio * 2 + batea.precio * 2);
    } else {
      expect(adicion.status).toBe(409);
      expect(final.subtotal).toBe(chumblun.precio * 2 + batea.precio);
    }
    expect(final.cuenta).toMatch(/TOTAL/);
  });
});
