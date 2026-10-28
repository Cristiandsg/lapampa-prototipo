// HU07 — Registrar el pago · HU08 — Calcular y registrar la propina
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
const ids = {};
let chumblun; // { id, precio }
let batea;
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    ids[rol] = await crearCuenta(`caja.${rol}`, rol);
    t[rol] = await tokenDe(`caja.${rol}`);
  }
  ids.mesero2 = await crearCuenta('caja.mesero2', 'mesero');
  t.mesero2 = await tokenDe('caja.mesero2');
  ids.cajero2 = await crearCuenta('caja.cajero2', 'cajero');
  t.cajero2 = await tokenDe('caja.cajero2');
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  [[batea]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Batea'");
});

beforeEach(async () => {
  await pool.query('DELETE FROM propina');
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
    patch: (url, datos) => conToken(request(app).patch(url)).send(datos),
  };
};

// 2 Chumblún + 1 Batea, con la cuenta generada. CONSUMO = total del pedido.
let CONSUMO;
let contador = 0;
async function cuentaPorCobrar(mesero = 'mesero') {
  contador += 1;
  const mesa = await como(mesero).post('/api/mesas', { nombre: `Caja ${contador}` });
  const pedido = await como(mesero).post('/api/pedidos', {
    mesaId: mesa.body.id,
    items: [
      { productoId: chumblun.id, cantidad: 2 },
      { productoId: batea.id, cantidad: 1 },
    ],
  });
  await como(mesero).patch(`/api/pedidos/${pedido.body.id}/cerrar`);
  CONSUMO = chumblun.precio * 2 + batea.precio;
  return { ...pedido.body, mesaId: mesa.body.id };
}

const cobrar = (pedidoId, datos, quien = 'cajero') =>
  como(quien).post(`/api/caja/pedidos/${pedidoId}/pagos`, datos);

const sinPropina = { respuesta: 'rechazada' };

describe('Registrar el pago (HU07)', () => {
  it('en efectivo: el pedido queda pagado, la mesa libre y sale de la bandeja', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: CONSUMO }],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'pagado', subtotal: CONSUMO });
    expect(res.body.pagado_en).toBeTruthy();
    expect(res.body.pagos).toEqual([
      expect.objectContaining({ medio: 'efectivo', valor: CONSUMO, cajero: 'Prueba caja.cajero' }),
    ]);

    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa).toMatchObject({ estado: 'libre', pedido: null });
    expect((await como('cajero').get('/api/caja/por-cobrar')).body).toEqual([]);

    // La mesa se puede volver a usar
    const otro = await como('mesero').post('/api/pedidos', {
      mesaId: pedido.mesaId,
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    expect(otro.status).toBe(201);
  });

  it('pago mixto: efectivo + tarjeta + transferencia con referencia', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: sinPropina,
      pagos: [
        { medio: 'efectivo', valor: 10000 },
        { medio: 'tarjeta', valor: 20000 },
        { medio: 'transferencia', valor: CONSUMO - 30000, referencia: ' Nequi 123 ' },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.pagos.map((p) => [p.medio, p.valor, p.referencia])).toEqual([
      ['efectivo', 10000, null],
      ['tarjeta', 20000, null],
      ['transferencia', CONSUMO - 30000, 'Nequi 123'],
    ]);
  });

  it('el cajero que cobra sale de la sesión, no del cuerpo de la petición', async () => {
    const pedido = await cuentaPorCobrar();
    await cobrar(
      pedido.id,
      {
        propina: sinPropina,
        pagos: [{ medio: 'tarjeta', valor: CONSUMO }],
        cajeroId: ids.propietario,
      },
      'cajero2',
    );
    const [[pago]] = await pool.query('SELECT cajero_id FROM pago WHERE pedido_id = ?', [
      pedido.id,
    ]);
    expect(pago.cajero_id).toBe(ids.cajero2);
  });

  it('deja el comprobante en la impresora de caja, con consumo y propina separados', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: { respuesta: 'aceptada' },
      pagos: [{ medio: 'efectivo', valor: CONSUMO + CONSUMO / 10 }],
    });
    const [[trabajo]] = await pool.query(
      "SELECT impresora, contenido FROM trabajo_impresion WHERE pedido_id = ? AND tipo = 'comprobante'",
      [pedido.id],
    );
    expect(trabajo.impresora).toBe('caja');
    expect(trabajo.contenido).toBe(res.body.comprobante);
    expect(trabajo.contenido).toContain('COMPROBANTE DE PAGO');
    expect(trabajo.contenido).toMatch(/Consumo +\$/);
    expect(trabajo.contenido).toMatch(/Propina voluntaria +\$/);
    expect(trabajo.contenido).toContain('Este documento no es factura.');
    for (const l of trabajo.contenido.split('\n')) expect(l.length).toBeLessThanOrEqual(32);
  });

  it('queda en el historial quién cobró y cómo', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: CONSUMO }],
    });
    expect(res.body.historial.at(-1)).toMatchObject({
      accion: 'pagar',
      usuario: 'Prueba caja.cajero',
      valor_nuevo: `Efectivo $${CONSUMO} + propina $0 (rechazada)`,
    });
  });
});

describe('Criterio de aceptación HU07: si los pagos no cuadran, no se guarda nada', () => {
  it.each([
    ['faltan', -1000, /Faltan \$1\.000/],
    ['sobran', 5000, /Sobran \$5\.000/],
  ])('cuando %s pesos responde 400 y el pedido sigue por cobrar', async (_, diferencia, msj) => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: CONSUMO + diferencia }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(msj);

    const [[{ pagos }]] = await pool.query(
      'SELECT COUNT(*) AS pagos FROM pago WHERE pedido_id = ?',
      [pedido.id],
    );
    const [[{ propinas }]] = await pool.query(
      'SELECT COUNT(*) AS propinas FROM propina WHERE pedido_id = ?',
      [pedido.id],
    );
    expect([pagos, propinas]).toEqual([0, 0]);
    expect((await como('cajero').get('/api/caja/por-cobrar')).body).toHaveLength(1);
  });

  it('si algo falla a mitad del pago, no queda nada registrado (rollback)', async () => {
    const pedido = await cuentaPorCobrar();
    // Simula una caída: borra al mesero del pedido para que falle el registro de la propina
    // (llave foránea) después de validar todo.
    const conexion = await pool.getConnection();
    await conexion.query('SET FOREIGN_KEY_CHECKS = 0');
    await conexion.query('UPDATE pedido SET mesero_id = 99999999 WHERE id = ?', [pedido.id]);
    await conexion.query('SET FOREIGN_KEY_CHECKS = 1');
    conexion.release();
    const res = await cobrar(pedido.id, {
      propina: { respuesta: 'aceptada' },
      pagos: [{ medio: 'efectivo', valor: CONSUMO + CONSUMO / 10 }],
    });
    expect(res.status).toBe(500);
    const [[{ pagos }]] = await pool.query(
      'SELECT COUNT(*) AS pagos FROM pago WHERE pedido_id = ?',
      [pedido.id],
    );
    const [[{ estado }]] = await pool.query('SELECT estado FROM pedido WHERE id = ?', [pedido.id]);
    expect(pagos).toBe(0);
    expect(estado).toBe('por_cobrar');
  });
});

describe('No se cobra lo que no está por cobrar', () => {
  it('un pedido abierto (sin cuenta) responde 409', async () => {
    contador += 1;
    const mesa = await como('mesero').post('/api/mesas', { nombre: `Abierta ${contador}` });
    const pedido = await como('mesero').post('/api/pedidos', {
      mesaId: mesa.body.id,
      items: [{ productoId: batea.id, cantidad: 1 }],
    });
    const res = await cobrar(pedido.body.id, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: batea.precio }],
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/sigue abierto: no se puede cobrar/);
  });

  it('un pedido ya pagado no se cobra dos veces (409)', async () => {
    const pedido = await cuentaPorCobrar();
    const pago = { propina: sinPropina, pagos: [{ medio: 'efectivo', valor: CONSUMO }] };
    await cobrar(pedido.id, pago);
    const res = await cobrar(pedido.id, pago);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya fue pagado/);
  });

  it('dos cajeros cobrando el mismo pedido a la vez: un solo cobro', async () => {
    const pedido = await cuentaPorCobrar();
    const pago = { propina: sinPropina, pagos: [{ medio: 'efectivo', valor: CONSUMO }] };
    const [a, b] = await Promise.all([
      cobrar(pedido.id, pago, 'cajero'),
      cobrar(pedido.id, pago, 'cajero2'),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM pago WHERE pedido_id = ?', [
      pedido.id,
    ]);
    expect(n).toBe(1);
  });

  it('un pedido que no existe responde 404', async () => {
    const res = await cobrar(999999, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: 1000 }],
    });
    expect(res.status).toBe(404);
  });
});

describe('Calcular y registrar la propina (HU08)', () => {
  it('aceptada: el 10 % del consumo, aparte, liquidada al mesero que tomó el pedido', async () => {
    const pedido = await cuentaPorCobrar('mesero2');
    const sugerida = CONSUMO / 10;
    const res = await cobrar(pedido.id, {
      propina: { respuesta: 'aceptada', valor: 999999 }, // el valor enviado se ignora
      pagos: [{ medio: 'tarjeta', valor: CONSUMO + sugerida }],
    });
    expect(res.status).toBe(201);
    expect(res.body.subtotal).toBe(CONSUMO); // el consumo no incluye la propina
    expect(res.body.propina).toEqual({
      valor_sugerido: sugerida,
      valor: sugerida,
      respuesta: 'aceptada',
    });
    const [[fila]] = await pool.query(
      'SELECT mesero_id, cajero_id FROM propina WHERE pedido_id = ?',
      [pedido.id],
    );
    expect(fila).toEqual({ mesero_id: ids.mesero2, cajero_id: ids.cajero });
  });

  it('modificada: el cliente da otro valor, incluso mayor que la sugerida', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: { respuesta: 'modificada', valor: 20000 },
      pagos: [
        { medio: 'efectivo', valor: 20000 },
        { medio: 'tarjeta', valor: CONSUMO },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.propina).toMatchObject({ valor: 20000, respuesta: 'modificada' });
  });

  it('rechazada: propina en cero y se paga solo el consumo', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, {
      propina: { respuesta: 'rechazada', valor: 5000 },
      pagos: [{ medio: 'efectivo', valor: CONSUMO }],
    });
    expect(res.status).toBe(201);
    expect(res.body.propina).toMatchObject({ valor: 0, respuesta: 'rechazada' });
  });

  it('criterio de aceptación: sin la respuesta del cliente no se cobra (400)', async () => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, { pagos: [{ medio: 'efectivo', valor: CONSUMO }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Confirma qué dijo el cliente de la propina/);
  });

  it('modificada sin valor, o mayor que el consumo, responde 400', async () => {
    const pedido = await cuentaPorCobrar();
    const sinValor = await cobrar(pedido.id, {
      propina: { respuesta: 'modificada' },
      pagos: [{ medio: 'efectivo', valor: CONSUMO }],
    });
    expect(sinValor.status).toBe(400);
    expect(sinValor.body.error).toMatch(/valor de la propina/);
    const exagerada = await cobrar(pedido.id, {
      propina: { respuesta: 'modificada', valor: CONSUMO + 1000 },
      pagos: [{ medio: 'efectivo', valor: CONSUMO * 2 + 1000 }],
    });
    expect(exagerada.status).toBe(400);
  });
});

describe('Validaciones y permisos', () => {
  it.each([
    [{ pagos: [] }, /entre uno y tres pagos/],
    [{ pagos: [{ medio: 'bitcoin', valor: 1000 }] }, /efectivo, tarjeta o transferencia/],
    [{ pagos: [{ medio: 'efectivo', valor: -5 }] }, /mayor que cero/],
    [{ pagos: [{ medio: 'efectivo', valor: 1000.5 }] }, /sin decimales/],
    [{ pagos: [{ medio: 'efectivo', valor: 'mil' }] }, /mayor que cero/],
    [
      {
        pagos: [
          { medio: 'efectivo', valor: 1000 },
          { medio: 'efectivo', valor: 2000 },
        ],
      },
      /una sola vez/,
    ],
    [{ pagos: [{ medio: 'transferencia', valor: 1000, referencia: 'x'.repeat(61) }] }, /60/],
  ])('rechaza %j (400), nunca 500', async (datos, mensaje) => {
    const pedido = await cuentaPorCobrar();
    const res = await cobrar(pedido.id, { propina: sinPropina, ...datos });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(mensaje);
  });

  it('el mesero no cobra (403); el propietario sí', async () => {
    const pedido = await cuentaPorCobrar();
    const pago = { propina: sinPropina, pagos: [{ medio: 'efectivo', valor: CONSUMO }] };
    expect((await cobrar(pedido.id, pago, 'mesero')).status).toBe(403);
    expect((await cobrar(pedido.id, pago, 'nadie')).status).toBe(401);
    expect((await cobrar(pedido.id, pago, 'propietario')).status).toBe(201);
  });

  it('después de pagar, el pedido ya no se reabre (409)', async () => {
    const pedido = await cuentaPorCobrar();
    await cobrar(pedido.id, {
      propina: sinPropina,
      pagos: [{ medio: 'efectivo', valor: CONSUMO }],
    });
    const res = await como('mesero').patch(`/api/pedidos/${pedido.id}/reabrir`, {
      motivo: 'Prueba',
    });
    expect(res.status).toBe(409);
  });
});

describe('Cierre de caja (HU07) y propinas por mesero (HU08)', () => {
  async function jornada() {
    const a = await cuentaPorCobrar('mesero');
    const b = await cuentaPorCobrar('mesero');
    const c = await cuentaPorCobrar('mesero2');
    await cuentaPorCobrar('mesero2'); // queda por cobrar
    await cobrar(a.id, {
      propina: { respuesta: 'aceptada' },
      pagos: [
        { medio: 'efectivo', valor: 50000 },
        { medio: 'tarjeta', valor: CONSUMO + CONSUMO / 10 - 50000 },
      ],
    });
    await cobrar(b.id, {
      propina: { respuesta: 'modificada', valor: 5000 },
      pagos: [{ medio: 'transferencia', valor: CONSUMO + 5000, referencia: 'Nequi' }],
    });
    await cobrar(c.id, { propina: sinPropina, pagos: [{ medio: 'efectivo', valor: CONSUMO }] });
  }

  it('totales del día por medio de pago, consumo, propinas por mesero y pendientes', async () => {
    await jornada();
    const res = await como('cajero').get('/api/caja/cierre');
    expect(res.status).toBe(200);
    const propinaA = CONSUMO / 10;
    expect(res.body.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.pedidosPagados).toBe(3);
    expect(res.body.consumo).toBe(CONSUMO * 3);
    expect(res.body.porMedio).toEqual([
      { medio: 'efectivo', total: 50000 + CONSUMO, pagos: 2 },
      { medio: 'tarjeta', total: CONSUMO + propinaA - 50000, pagos: 1 },
      { medio: 'transferencia', total: CONSUMO + 5000, pagos: 1 },
    ]);
    expect(res.body.propinas.total).toBe(propinaA + 5000);
    expect(res.body.propinas.porMesero).toEqual([
      {
        mesero: 'Prueba caja.mesero',
        total: propinaA + 5000,
        pedidos: 2,
        aceptadas: 1,
        modificadas: 1,
        rechazadas: 0,
      },
      {
        mesero: 'Prueba caja.mesero2',
        total: 0,
        pedidos: 1,
        aceptadas: 0,
        modificadas: 0,
        rechazadas: 1,
      },
    ]);
    // Lo recaudado es exactamente el consumo más las propinas
    expect(res.body.totalRecaudado).toBe(res.body.consumo + res.body.propinas.total);
    expect(res.body.porCobrar).toEqual({ cantidad: 1, total: CONSUMO });
  });

  it('filtra por el día de Colombia (la base trabaja en hora -05:00)', async () => {
    await jornada();
    const [[{ hoy }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hoy");
    const res = await como('cajero').get(`/api/caja/cierre?fecha=${hoy}`);
    expect(res.body.fecha).toBe(hoy);
    expect(res.body.pedidosPagados).toBe(3);
    const ayer = await como('cajero').get('/api/caja/cierre?fecha=2020-01-01');
    expect(ayer.body).toMatchObject({ pedidosPagados: 0, totalRecaudado: 0 });
  });

  it('responde en menos de 5 segundos', async () => {
    await jornada();
    const inicio = Date.now();
    await como('propietario').get('/api/caja/cierre');
    expect(Date.now() - inicio).toBeLessThan(5000);
  });

  it.each(['ayer', '2026-13-01', '26-10-2026', '2026-10-27T00:00'])(
    'una fecha inválida (%s) responde 400',
    async (fecha) => {
      const res = await como('cajero').get(`/api/caja/cierre?fecha=${fecha}`);
      expect(res.status).toBe(400);
    },
  );

  it('el mesero no ve el cierre (403)', async () => {
    expect((await como('mesero').get('/api/caja/cierre')).status).toBe(403);
  });
});
