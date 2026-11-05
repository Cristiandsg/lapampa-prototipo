// HU09 — Formulario web de domicilio para el cliente (público, sin inicio de sesión)
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');
const limitePedidos = require('../src/middlewares/limitePedidos');

let chumblun; // { id, precio }
let batea;
let tokenMesero;

async function limpiar() {
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM domicilio');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('DELETE FROM cliente');
  await pool.query("DELETE FROM historial_cambio WHERE entidad IN ('pedido', 'domicilio')");
}

beforeAll(async () => {
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  [[batea]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Batea'");
  chumblun.precio = Number(chumblun.precio);
  batea.precio = Number(batea.precio);
  await crearCuenta('domicilios.mesero', 'mesero');
  tokenMesero = await tokenDe('domicilios.mesero');
});

beforeEach(async () => {
  limitePedidos.reiniciar();
  await limpiar();
  await pool.query('UPDATE producto SET activo = TRUE, agotado_hoy = FALSE');
  await pool.query('UPDATE categoria SET activa = TRUE');
});

// Los otros archivos de pruebas borran pedidos: no se dejan domicilios que los amarren
afterAll(async () => {
  await limpiar();
  await pool.end();
});

const enviar = (datos) => request(app).post('/api/domicilios/publico').send(datos);

const pedidoBase = (cambios = {}) => ({
  autorizaDatos: true,
  items: [
    { productoId: chumblun.id, cantidad: 2, nota: 'sin cebolla' },
    { productoId: batea.id, cantidad: 1 },
  ],
  cliente: {
    nombre: 'Yesenia Caicedo',
    telefono: '3001234567',
    direccion: 'Calle 70 # 3BN-45',
    barrio: 'La Primavera',
    referencia: 'Casa esquinera, portón negro',
  },
  metodoPago: 'contra_entrega',
  observaciones: 'Timbre dañado, llamar al llegar',
  ...cambios,
});

const contar = async (tabla) => (await pool.query(`SELECT COUNT(*) AS n FROM ${tabla}`))[0][0].n;

describe('Carta pública del formulario', () => {
  it('muestra sin sesión los productos que se pueden pedir hoy, por categoría, y el envío', async () => {
    await pool.query('UPDATE producto SET agotado_hoy = TRUE WHERE id = ?', [batea.id]);
    const res = await request(app).get('/api/domicilios/publico/carta');
    expect(res.status).toBe(200);
    expect(res.body.valorEnvio).toBe(7000);
    expect(res.body.whatsapp).toBe('3195654739');
    expect(res.body.transferencia).toMatchObject({
      banco: 'Bancolombia',
      tipo: 'Cuenta de ahorros',
      numero: '80819808345',
    });
    const productos = res.body.categorias.flatMap((c) => c.productos);
    expect(productos.find((p) => p.id === chumblun.id)).toMatchObject({
      nombre: 'Chumblún',
      precio: chumblun.precio,
    });
    expect(productos.find((p) => p.id === batea.id)).toBeUndefined(); // agotado hoy
    // Solo datos públicos
    expect(Object.keys(productos[0]).sort()).toEqual(['descripcion', 'id', 'nombre', 'precio']);
  });

  it('no muestra los productos de una categoría desactivada', async () => {
    await pool.query(
      'UPDATE categoria SET activa = FALSE WHERE id = (SELECT categoria_id FROM producto WHERE id = ?)',
      [chumblun.id],
    );
    const res = await request(app).get('/api/domicilios/publico/carta');
    const productos = res.body.categorias.flatMap((c) => c.productos);
    expect(productos.find((p) => p.id === chumblun.id)).toBeUndefined();
  });
});

describe('Pedido contra entrega', () => {
  it('queda recibido, con el envío, el precio del momento y la comanda en la cola de cocina', async () => {
    const res = await enviar(pedidoBase());
    expect(res.status).toBe(201);
    const subtotal = chumblun.precio * 2 + batea.precio;
    expect(res.body).toMatchObject({
      canal: 'web',
      estado: 'recibido',
      metodoPago: 'contra_entrega',
      subtotal,
      valorEnvio: 7000,
      total: subtotal + 7000,
      pago: null,
    });
    expect(res.body.pedidoId).toEqual(expect.any(Number));
    expect(res.body.items).toEqual([
      expect.objectContaining({ nombre: 'Chumblún', cantidad: 2, nota: 'sin cebolla' }),
      expect.objectContaining({ nombre: 'Batea', cantidad: 1 }),
    ]);

    const [[pedido]] = await pool.query('SELECT * FROM pedido WHERE id = ?', [res.body.pedidoId]);
    expect(pedido).toMatchObject({ canal: 'domicilio', mesa_id: null, mesero_id: null });
    expect(pedido.observaciones).toBe('Timbre dañado, llamar al llegar');

    const [[domicilio]] = await pool.query('SELECT * FROM domicilio WHERE pedido_id = ?', [
      res.body.pedidoId,
    ]);
    expect(domicilio).toMatchObject({
      canal: 'web',
      metodo_pago: 'contra_entrega',
      estado: 'recibido',
      direccion_entrega: 'Calle 70 # 3BN-45',
      registrado_por: null,
    });
    expect(Number(domicilio.valor_envio)).toBe(7000);

    const [cola] = await pool.query('SELECT * FROM trabajo_impresion WHERE pedido_id = ?', [
      res.body.pedidoId,
    ]);
    expect(cola).toHaveLength(1);
    expect(cola[0]).toMatchObject({ tipo: 'comanda', impresora: 'cocina', solicitado_por: null });
    expect(cola[0].contenido).toContain('DOMICILIO');
    expect(cola[0].contenido).not.toContain('null');
    expect(cola[0].contenido).toContain('sin cebolla');

    // Historial del pedido y del domicilio, hecho por el cliente (usuario NULL)
    const [historial] = await pool.query(
      `SELECT entidad, accion, usuario_id FROM historial_cambio
        WHERE (entidad = 'pedido' AND entidad_id = ?) OR (entidad = 'domicilio' AND entidad_id = ?)`,
      [res.body.pedidoId, res.body.domicilioId],
    );
    expect(historial).toEqual(
      expect.arrayContaining([
        { entidad: 'pedido', accion: 'crear', usuario_id: null },
        { entidad: 'domicilio', accion: 'crear', usuario_id: null },
      ]),
    );
  });

  it('guarda el cliente con la autorización del formulario web (Ley 1581)', async () => {
    await enviar(pedidoBase());
    const [[cliente]] = await pool.query('SELECT * FROM cliente WHERE telefono = ?', [
      '3001234567',
    ]);
    expect(cliente).toMatchObject({
      nombre: 'Yesenia Caicedo',
      direccion: 'Calle 70 # 3BN-45',
      barrio: 'La Primavera',
      referencia: 'Casa esquinera, portón negro',
      autoriza_datos: 1,
      autorizacion_medio: 'formulario_web',
    });
    expect(cliente.autorizacion_fecha).toBeInstanceOf(Date);
  });

  it('un cliente que vuelve a pedir con el mismo teléfono actualiza sus datos, sin duplicarse', async () => {
    await enviar(pedidoBase());
    const res = await enviar(
      pedidoBase({
        cliente: {
          nombre: 'Yesenia Caicedo',
          telefono: '+57 300 123 4567',
          direccion: 'Carrera 1 # 72-10',
        },
      }),
    );
    expect(res.status).toBe(201);
    const [clientes] = await pool.query('SELECT * FROM cliente');
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({
      telefono: '3001234567',
      direccion: 'Carrera 1 # 72-10',
      barrio: null,
    });
    const [domicilios] = await pool.query('SELECT cliente_id FROM domicilio');
    expect(domicilios.map((d) => d.cliente_id)).toEqual([clientes[0].id, clientes[0].id]);
  });

  it('el pedido de domicilio se puede consultar con sesión y su comanda dice DOMICILIO', async () => {
    const { body } = await enviar(pedidoBase());
    const res = await request(app)
      .get(`/api/pedidos/${body.pedidoId}`)
      .set('Authorization', `Bearer ${tokenMesero}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ canal: 'domicilio', mesa: null });
    expect(res.body.comanda).toContain('*** DOMICILIO ***');
    expect(res.body.cuenta).toContain('*** DOMICILIO ***');
    expect(res.body.cuenta).not.toContain('null');
  });
});

describe('Pedido por transferencia', () => {
  it('queda en pendiente de pago, con los datos para consignar, y no va a cocina', async () => {
    const res = await enviar(pedidoBase({ metodoPago: 'transferencia' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: 'pendiente_pago', metodoPago: 'transferencia' });
    expect(res.body.pago).toMatchObject({
      banco: 'Bancolombia',
      tipo: 'Cuenta de ahorros',
      numero: '80819808345',
      whatsapp: '3195654739',
    });

    const [[domicilio]] = await pool.query('SELECT * FROM domicilio WHERE pedido_id = ?', [
      res.body.pedidoId,
    ]);
    expect(domicilio).toMatchObject({ estado: 'pendiente_pago', pago_confirmado_en: null });
    // Criterio de aceptación: no aparece para preparar hasta que se confirme el pago
    expect(await contar('trabajo_impresion')).toBe(0);
  });
});

describe('Sin autorización de datos no se recibe el pedido', () => {
  it.each([
    ['falsa', false],
    ['como texto', 'true'],
    ['como número', 1],
    ['sin marcar', undefined],
  ])('autorización %s → 400 y no guarda nada', async (_caso, valor) => {
    const res = await enviar(pedidoBase({ autorizaDatos: valor }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/autorizar el tratamiento de tus datos/);
    expect(await contar('cliente')).toBe(0);
    expect(await contar('pedido')).toBe(0);
  });
});

describe('Validaciones del formulario', () => {
  it('sin productos → 400', async () => {
    const res = await enviar(pedidoBase({ items: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Agrega al menos un producto a tu pedido.');
  });

  it('un producto agotado hoy → 409, y no queda ni el cliente ni el pedido', async () => {
    await pool.query('UPDATE producto SET agotado_hoy = TRUE WHERE id = ?', [batea.id]);
    const res = await enviar(pedidoBase());
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('"Batea" está agotado hoy.');
    expect(await contar('cliente')).toBe(0);
    expect(await contar('pedido')).toBe(0);
  });

  it('un producto desactivado → 409', async () => {
    await pool.query('UPDATE producto SET activo = FALSE WHERE id = ?', [batea.id]);
    const res = await enviar(pedidoBase());
    expect(res.status).toBe(409);
  });

  it('un producto que no existe → 400', async () => {
    const res = await enviar(pedidoBase({ items: [{ productoId: 999999, cantidad: 1 }] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Uno de los productos no existe.');
  });

  const conCliente = (cambios) => pedidoBase({ cliente: { ...pedidoBase().cliente, ...cambios } });

  // Un dato mal escrito nunca puede dar 500 (forma de trabajo, sección 4)
  it.each([
    ['sin cuerpo', () => undefined],
    ['items no es lista', () => pedidoBase({ items: 'chumblún' })],
    ['producto nulo', () => pedidoBase({ items: [null] })],
    ['cantidad cero', () => pedidoBase({ items: [{ productoId: chumblun.id, cantidad: 0 }] })],
    ['cantidad 100', () => pedidoBase({ items: [{ productoId: 1, cantidad: 100 }] })],
    ['cantidad con decimales', () => pedidoBase({ items: [{ productoId: 1, cantidad: 1.5 }] })],
    ['id gigante', () => pedidoBase({ items: [{ productoId: 99999999999, cantidad: 1 }] })],
    [
      'nota muy larga',
      () => pedidoBase({ items: [{ productoId: 1, cantidad: 1, nota: 'x'.repeat(121) }] }),
    ],
    ['sin cliente', () => pedidoBase({ cliente: undefined })],
    ['cliente como texto', () => pedidoBase({ cliente: 'Yesenia' })],
    ['nombre vacío', () => conCliente({ nombre: '   ' })],
    ['nombre muy largo', () => conCliente({ nombre: 'a'.repeat(81) })],
    ['nombre como número', () => conCliente({ nombre: 123 })],
    ['teléfono corto', () => conCliente({ telefono: '300123' })],
    ['teléfono con letras', () => conCliente({ telefono: '300abc4567' })],
    ['teléfono como número', () => conCliente({ telefono: 3001234567 })],
    ['sin dirección', () => conCliente({ direccion: undefined })],
    ['dirección muy larga', () => conCliente({ direccion: 'a'.repeat(151) })],
    ['barrio muy largo', () => conCliente({ barrio: 'a'.repeat(61) })],
    ['referencia como objeto', () => conCliente({ referencia: { a: 1 } })],
    ['método de pago inventado', () => pedidoBase({ metodoPago: 'bitcoin' })],
    ['sin método de pago', () => pedidoBase({ metodoPago: undefined })],
    ['observaciones muy largas', () => pedidoBase({ observaciones: 'a'.repeat(256) })],
  ])('%s → 400', async (_caso, datos) => {
    const res = await enviar(datos());
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(await contar('pedido')).toBe(0);
  });

  it('acepta un fijo con el indicativo nuevo y los campos opcionales vacíos', async () => {
    const res = await enviar(
      pedidoBase({
        cliente: {
          nombre: 'Don Aurelio',
          telefono: '602 555 1234',
          direccion: 'Avenida 4N # 70-20',
          barrio: '',
          referencia: '   ',
        },
        observaciones: '',
      }),
    );
    expect(res.status).toBe(201);
    const [[cliente]] = await pool.query('SELECT * FROM cliente');
    expect(cliente).toMatchObject({ telefono: '6025551234', barrio: null, referencia: null });
  });
});

describe('Límite de pedidos por dispositivo', () => {
  it('después de 5 pedidos en una hora responde 429; los formularios con errores no cuentan', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await enviar(pedidoBase({ items: [] }))).status).toBe(400);
    }
    for (let i = 0; i < 5; i++) {
      expect((await enviar(pedidoBase())).status).toBe(201);
    }
    const res = await enviar(pedidoBase());
    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/5 pedidos en la última hora/);
    expect(res.headers['retry-after']).toBeDefined();
    expect(await contar('pedido')).toBe(5);
  });
});
