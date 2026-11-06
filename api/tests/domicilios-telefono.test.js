// HU10 — El cajero registra los domicilios que llegan por llamada o WhatsApp
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

let chumblun;
let cajeroId;
const token = {};

async function limpiar() {
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM domicilio');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('DELETE FROM cliente');
  await pool.query("DELETE FROM historial_cambio WHERE entidad IN ('pedido', 'domicilio')");
}

beforeAll(async () => {
  await limpiar(); // los domicilios amarran al cajero: se borran antes de recrear su cuenta
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  chumblun.precio = Number(chumblun.precio);
  cajeroId = await crearCuenta('telefono.cajero', 'cajero');
  await crearCuenta('telefono.propietario', 'propietario');
  await crearCuenta('telefono.mesero', 'mesero');
  token.cajero = await tokenDe('telefono.cajero');
  token.propietario = await tokenDe('telefono.propietario');
  token.mesero = await tokenDe('telefono.mesero');
});

beforeEach(async () => {
  await limpiar();
  await pool.query('UPDATE producto SET activo = TRUE, agotado_hoy = FALSE');
  await pool.query('UPDATE categoria SET activa = TRUE');
});

afterAll(async () => {
  await limpiar();
  await pool.end();
});

const datos = (cambios = {}) => ({
  autorizaDatos: true,
  items: [{ productoId: chumblun.id, cantidad: 1 }],
  cliente: {
    nombre: 'Don Aurelio Mosquera',
    telefono: '3157778899',
    direccion: 'Carrera 1 # 72-10',
    barrio: 'Floralia',
  },
  metodoPago: 'contra_entrega',
  ...cambios,
});

const registrar = (rol, cuerpo = datos()) => {
  const req = request(app).post('/api/domicilios').send(cuerpo);
  return rol ? req.set('Authorization', `Bearer ${token[rol]}`) : req;
};

const buscar = (rol, telefono) => {
  const req = request(app).get('/api/domicilios/clientes').query({ telefono });
  return rol ? req.set('Authorization', `Bearer ${token[rol]}`) : req;
};

describe('Registrar un domicilio por llamada o WhatsApp', () => {
  it('el cajero lo registra con canal teléfono/WhatsApp y queda como quien lo registró', async () => {
    const res = await registrar('cajero');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      canal: 'telefono_whatsapp',
      estado: 'recibido',
      subtotal: chumblun.precio,
      valorEnvio: 7000,
      total: chumblun.precio + 7000,
    });

    const [[domicilio]] = await pool.query('SELECT * FROM domicilio WHERE pedido_id = ?', [
      res.body.pedidoId,
    ]);
    expect(domicilio).toMatchObject({ canal: 'telefono_whatsapp', registrado_por: cajeroId });

    const [[cliente]] = await pool.query('SELECT * FROM cliente');
    expect(cliente).toMatchObject({
      telefono: '3157778899',
      autoriza_datos: 1,
      autorizacion_medio: 'telefono_whatsapp',
    });

    // El historial dice qué cajero lo registró
    const [historial] = await pool.query(
      `SELECT entidad, usuario_id FROM historial_cambio
        WHERE (entidad = 'pedido' AND entidad_id = ?) OR (entidad = 'domicilio' AND entidad_id = ?)`,
      [res.body.pedidoId, res.body.domicilioId],
    );
    expect(historial).toEqual(
      expect.arrayContaining([
        { entidad: 'pedido', usuario_id: cajeroId },
        { entidad: 'domicilio', usuario_id: cajeroId },
      ]),
    );

    // Contra entrega: la comanda va a cocina
    const [cola] = await pool.query('SELECT solicitado_por, contenido FROM trabajo_impresion');
    expect(cola).toHaveLength(1);
    expect(cola[0].solicitado_por).toBe(cajeroId);
    expect(cola[0].contenido).toContain('DOMICILIO');
  });

  it('por transferencia queda pendiente de pago, sin comanda, y trae la cuenta para dictarla', async () => {
    const res = await registrar('cajero', datos({ metodoPago: 'transferencia' }));
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('pendiente_pago');
    expect(res.body.pago).toMatchObject({ banco: 'Bancolombia', numero: '80819808345' });
    const [cola] = await pool.query('SELECT id FROM trabajo_impresion');
    expect(cola).toHaveLength(0);
  });

  it('el propietario también puede registrarlo', async () => {
    expect((await registrar('propietario')).status).toBe(201);
  });

  it('un mesero recibe 403 y no se guarda nada', async () => {
    const res = await registrar('mesero');
    expect(res.status).toBe(403);
    const [pedidos] = await pool.query('SELECT id FROM pedido');
    expect(pedidos).toHaveLength(0);
  });

  it('sin sesión recibe 401', async () => {
    expect((await registrar(null)).status).toBe(401);
  });

  it.each([
    ['falsa', false],
    ['sin marcar', undefined],
    ['como texto', 'si'],
  ])('sin la autorización del cliente (%s) → 400 y no guarda nada', async (_caso, valor) => {
    const res = await registrar('cajero', datos({ autorizaDatos: valor }));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/el cliente autorizó el tratamiento de sus datos/);
    const [clientes] = await pool.query('SELECT id FROM cliente');
    expect(clientes).toHaveLength(0);
  });

  it('valida los datos igual que el formulario web (nunca 500)', async () => {
    const malos = [
      datos({ items: [] }),
      datos({ metodoPago: 'fiado' }),
      datos({ cliente: { ...datos().cliente, telefono: '12345' } }),
      datos({ cliente: { ...datos().cliente, direccion: '' } }),
      datos({ items: [{ productoId: chumblun.id, cantidad: 0 }] }),
    ];
    for (const cuerpo of malos) {
      expect((await registrar('cajero', cuerpo)).status).toBe(400);
    }
  });

  it('un producto agotado → 409', async () => {
    await pool.query('UPDATE producto SET agotado_hoy = TRUE WHERE id = ?', [chumblun.id]);
    expect((await registrar('cajero')).status).toBe(409);
  });

  it('no tiene el límite de 5 por hora del formulario público', async () => {
    for (let i = 0; i < 7; i++) {
      expect((await registrar('cajero')).status).toBe(201);
    }
  });
});

describe('Buscar un cliente por teléfono', () => {
  it('un cliente que ya pidió por la web se encuentra y trae sus datos y su autorización', async () => {
    await request(app)
      .post('/api/domicilios/publico')
      .send(datos({ cliente: { ...datos().cliente, referencia: 'Frente a la panadería' } }));

    const res = await buscar('cajero', '315 777 8899');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      nombre: 'Don Aurelio Mosquera',
      telefono: '3157778899',
      direccion: 'Carrera 1 # 72-10',
      barrio: 'Floralia',
      referencia: 'Frente a la panadería',
      autorizacionMedio: 'formulario_web',
    });
    expect(res.body.autorizacionFecha).toEqual(expect.any(String));
  });

  it('un cliente ya registrado que vuelve a pedir por teléfono no se duplica', async () => {
    await registrar('cajero');
    await registrar(
      'cajero',
      datos({ cliente: { ...datos().cliente, direccion: 'Calle 5 # 1-1' } }),
    );
    const [clientes] = await pool.query('SELECT direccion FROM cliente');
    expect(clientes).toEqual([{ direccion: 'Calle 5 # 1-1' }]);
  });

  it('un cliente nuevo → 404', async () => {
    const res = await buscar('cajero', '3009998877');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/cliente nuevo/);
  });

  it.each([['123'], ['abc'], ['']])('un celular inválido (%j) → 400', async (telefono) => {
    expect((await buscar('cajero', telefono)).status).toBe(400);
  });

  it('el propietario puede buscar; un mesero recibe 403; sin sesión 401', async () => {
    await registrar('cajero');
    expect((await buscar('propietario', '3157778899')).status).toBe(200);
    expect((await buscar('mesero', '3157778899')).status).toBe(403);
    expect((await buscar(null, '3157778899')).status).toBe(401);
  });
});
