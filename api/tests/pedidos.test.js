// HU04 — Registrar pedido por mesa
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
const ids = {};
let chumblun; // { id, precio }
let batea;
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    ids[rol] = await crearCuenta(`pedidos.${rol}`, rol);
    t[rol] = await tokenDe(`pedidos.${rol}`);
  }
  t.mesero2 = await tokenDe((await crearCuenta('pedidos.mesero2', 'mesero'), 'pedidos.mesero2'));
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

const como = (quien) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${t[quien]}`),
  post: (url, datos) =>
    request(app).post(url).set('Authorization', `Bearer ${t[quien]}`).send(datos),
});

async function crearMesa(nombre) {
  return (await como('mesero').post('/api/mesas', { nombre })).body.id;
}

const pedidoBase = (mesaId) => ({
  mesaId,
  items: [
    { productoId: chumblun.id, cantidad: 2, nota: 'sin cebolla' },
    { productoId: batea.id, cantidad: 1 },
  ],
  observaciones: 'Cumpleaños, traer velita',
});

describe('Registrar un pedido en una mesa libre', () => {
  it('guarda el pedido con número, hora, mesero, detalle y precios del momento', async () => {
    const mesaId = await crearMesa('Terraza 2');
    const res = await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      canal: 'mesa',
      estado: 'abierto',
      mesa: 'Terraza 2',
      mesero: 'Prueba pedidos.mesero',
      subtotal: chumblun.precio * 2 + batea.precio,
      observaciones: 'Cumpleaños, traer velita',
    });
    expect(res.body.id).toEqual(expect.any(Number));
    expect(res.body.creado_en).toBeTruthy();
    expect(res.body.items).toEqual([
      expect.objectContaining({
        nombre: 'Chumblún',
        cantidad: 2,
        precio_unitario: chumblun.precio,
        nota: 'sin cebolla',
      }),
      expect.objectContaining({
        nombre: 'Batea',
        cantidad: 1,
        precio_unitario: batea.precio,
        nota: null,
      }),
    ]);
  });

  it('la mesa queda ocupada y muestra el total del pedido', async () => {
    const mesaId = await crearMesa('Barra');
    await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.estado).toBe('ocupada');
    expect(mesa.pedido.total).toBe(chumblun.precio * 2 + batea.precio);
  });

  it('deja la comanda en la cola de impresión de cocina con mesa, hora, mesero y notas', async () => {
    const mesaId = await crearMesa('Cumpleaños Andrea');
    const res = await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    const [[trabajo]] = await pool.query(
      'SELECT tipo, impresora, estado, contenido, solicitado_por FROM trabajo_impresion WHERE pedido_id = ?',
      [res.body.id],
    );
    expect(trabajo).toMatchObject({
      tipo: 'comanda',
      impresora: 'cocina',
      estado: 'pendiente',
      solicitado_por: ids.mesero,
    });
    expect(trabajo.contenido).toContain('MESA: Cumpleaños Andrea');
    expect(trabajo.contenido).toContain(`Pedido #${res.body.id}`);
    expect(trabajo.contenido).toContain('Mesero: Prueba pedidos.mesero');
    expect(trabajo.contenido).toMatch(/Hora: /);
    expect(trabajo.contenido).toContain('2 x Chumblún');
    expect(trabajo.contenido).toContain('* sin cebolla');
    expect(trabajo.contenido).toContain('OBS: Cumpleaños, traer velita');
    for (const linea of trabajo.contenido.split('\n')) expect(linea.length).toBeLessThanOrEqual(32);
    expect(res.body.comanda).toBe(trabajo.contenido);
  });

  it('junta en una línea el mismo producto con la misma nota', async () => {
    const mesaId = await crearMesa('Patio');
    const res = await como('mesero').post('/api/pedidos', {
      mesaId,
      items: [
        { productoId: chumblun.id, cantidad: 1 },
        { productoId: chumblun.id, cantidad: 2 },
        { productoId: chumblun.id, cantidad: 1, nota: 'bien dorado' },
      ],
    });
    expect(res.body.items.map((i) => [i.cantidad, i.nota])).toEqual([
      [3, null],
      [1, 'bien dorado'],
    ]);
  });

  it('queda en el historial quién tomó el pedido', async () => {
    const mesaId = await crearMesa('Ventana');
    const res = await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    const [[h]] = await pool.query(
      "SELECT accion, usuario_id FROM historial_cambio WHERE entidad = 'pedido' AND entidad_id = ?",
      [res.body.id],
    );
    expect(h).toEqual({ accion: 'crear', usuario_id: ids.mesero });
  });

  it('el propietario también puede tomar pedidos; el cajero no (403)', async () => {
    const m1 = await crearMesa('Terraza 1');
    const m2 = await crearMesa('Terraza 3');
    expect((await como('propietario').post('/api/pedidos', pedidoBase(m1))).status).toBe(201);
    expect((await como('cajero').post('/api/pedidos', pedidoBase(m2))).status).toBe(403);
  });
});

describe('Criterio de aceptación: una mesa ocupada no recibe un segundo pedido', () => {
  it('el segundo pedido en la misma mesa responde 409', async () => {
    const mesaId = await crearMesa('Terraza 2');
    await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    const res = await como('mesero2').post('/api/pedidos', pedidoBase(mesaId));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya tiene un pedido abierto/);
  });

  it('dos meseros abriendo la misma mesa al mismo tiempo: solo uno lo logra', async () => {
    const mesaId = await crearMesa('Barra');
    const [a, b] = await Promise.all([
      como('mesero').post('/api/pedidos', pedidoBase(mesaId)),
      como('mesero2').post('/api/pedidos', pedidoBase(mesaId)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM pedido WHERE mesa_id = ?', [
      mesaId,
    ]);
    expect(n).toBe(1);
  });

  it('tres celulares registrando pedidos en mesas distintas a la vez: no se pierde ninguno (RNF06)', async () => {
    const mesas = [await crearMesa('A'), await crearMesa('B'), await crearMesa('C')];
    const quienes = ['mesero', 'mesero2', 'propietario'];
    const respuestas = await Promise.all(
      mesas.map((m, i) => como(quienes[i]).post('/api/pedidos', pedidoBase(m))),
    );
    expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201]);
    const numeros = respuestas.map((r) => r.body.id);
    expect(new Set(numeros).size).toBe(3);
  });
});

describe('Validaciones', () => {
  it('un pedido sin productos falla (400)', async () => {
    const mesaId = await crearMesa('Terraza 1');
    const res = await como('mesero').post('/api/pedidos', { mesaId, items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/al menos un producto/);
    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.estado).toBe('libre');
  });

  it.each([0, -1, 100, 'dos'])('rechaza la cantidad %p (400)', async (cantidad) => {
    const mesaId = await crearMesa('Terraza 1');
    const res = await como('mesero').post('/api/pedidos', {
      mesaId,
      items: [{ productoId: chumblun.id, cantidad }],
    });
    expect(res.status).toBe(400);
  });

  it('no deja pedir un producto agotado hoy, y no guarda nada (409)', async () => {
    const mesaId = await crearMesa('Terraza 1');
    await pool.query('UPDATE producto SET agotado_hoy = TRUE WHERE id = ?', [batea.id]);
    const res = await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('"Batea" está agotado hoy.');
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM pedido');
    expect(n).toBe(0);
    const [mesa] = (await como('mesero').get('/api/mesas')).body;
    expect(mesa.estado).toBe('libre');
  });

  it('no deja pedir un producto desactivado (409)', async () => {
    const mesaId = await crearMesa('Terraza 1');
    await pool.query('UPDATE producto SET activo = FALSE WHERE id = ?', [chumblun.id]);
    const res = await como('mesero').post('/api/pedidos', pedidoBase(mesaId));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/ya no está en la carta/);
  });

  it('un producto que no existe responde 400', async () => {
    const mesaId = await crearMesa('Terraza 1');
    const res = await como('mesero').post('/api/pedidos', {
      mesaId,
      items: [{ productoId: 999999, cantidad: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('una mesa que no existe o fue eliminada responde 404', async () => {
    expect((await como('mesero').post('/api/pedidos', pedidoBase(999999))).status).toBe(404);
  });
});

describe('Ver un pedido', () => {
  it('devuelve el detalle y la comanda; el precio guardado no cambia si cambia la carta', async () => {
    const mesaId = await crearMesa('Terraza 2');
    const creado = (await como('mesero').post('/api/pedidos', pedidoBase(mesaId))).body;
    await pool.query('UPDATE producto SET precio = precio + 5000 WHERE id = ?', [chumblun.id]);

    const res = await como('cajero').get(`/api/pedidos/${creado.id}`);
    expect(res.status).toBe(200);
    expect(res.body.items[0].precio_unitario).toBe(chumblun.precio);
    expect(res.body.subtotal).toBe(creado.subtotal);
    expect(res.body.comanda).toContain('MESA: Terraza 2');
    await pool.query('UPDATE producto SET precio = precio - 5000 WHERE id = ?', [chumblun.id]);
  });

  it('responde 404 si no existe', async () => {
    expect((await como('mesero').get('/api/pedidos/999999')).status).toBe(404);
  });
});
