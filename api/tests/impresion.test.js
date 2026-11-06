// HU16 — Imprimir comandas y cuentas en las impresoras del local
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');
const impresionModel = require('../src/models/impresion.model');

const CLAVE = process.env.CLAVE_AGENTE_IMPRESION; // la pone tests/apoyo/entorno.js
const t = {};
let chumblun;
let contador = 0;

beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    await crearCuenta(`impresion.${rol}`, rol);
    t[rol] = await tokenDe(`impresion.${rol}`);
  }
  [[chumblun]] = await pool.query("SELECT id, precio FROM producto WHERE nombre = 'Chumblún'");
  chumblun.precio = Number(chumblun.precio);
});

async function limpiar() {
  await pool.query('DELETE FROM propina');
  await pool.query('DELETE FROM pago');
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('UPDATE mesa SET activa = FALSE');
}

beforeEach(async () => {
  await limpiar();
  await pool.query('UPDATE producto SET activo = TRUE, agotado_hoy = FALSE');
  impresionModel.reiniciarSeñal();
  process.env.CLAVE_AGENTE_IMPRESION = CLAVE;
});

afterAll(async () => {
  await limpiar();
  await pool.end();
});

const como = (quien) => {
  const conToken = (r) => (t[quien] ? r.set('Authorization', `Bearer ${t[quien]}`) : r);
  return {
    get: (url) => conToken(request(app).get(url)),
    post: (url, datos) => conToken(request(app).post(url)).send(datos),
    patch: (url, datos) => conToken(request(app).patch(url)).send(datos),
  };
};

const agente = {
  pendientes: (consulta = {}, clave = CLAVE) => {
    const req = request(app).get('/api/impresion/pendientes').query(consulta);
    return clave ? req.set('X-Clave-Agente', clave) : req;
  },
  marcar: (id, datos, clave = CLAVE) => {
    const req = request(app).patch(`/api/impresion/${id}`).send(datos);
    return clave ? req.set('X-Clave-Agente', clave) : req;
  },
};

// Un pedido de mesa con la comanda ya en la cola de cocina
async function pedidoEnviado() {
  contador += 1;
  const mesa = await como('mesero').post('/api/mesas', { nombre: `Impresión ${contador}` });
  const pedido = await como('mesero').post('/api/pedidos', {
    mesaId: mesa.body.id,
    items: [{ productoId: chumblun.id, cantidad: 2 }],
  });
  return pedido.body;
}

async function pedidoPagado() {
  const pedido = await pedidoEnviado();
  await como('mesero').patch(`/api/pedidos/${pedido.id}/cerrar`);
  await como('cajero').post(`/api/caja/pedidos/${pedido.id}/pagos`, {
    propina: { respuesta: 'rechazada' },
    pagos: [{ medio: 'efectivo', valor: chumblun.precio * 2 }],
  });
  return pedido;
}

describe('Cola para el agente de impresión', () => {
  it('entrega los trabajos pendientes en orden, con la tirilla ya armada', async () => {
    const pagado = await pedidoPagado(); // comanda (cocina), cuenta y comprobante (caja)
    const res = await agente.pendientes();
    expect(res.status).toBe(200);
    expect(res.body.map((x) => [x.tipo, x.impresora])).toEqual([
      ['comanda', 'cocina'],
      ['cuenta', 'caja'],
      ['comprobante', 'caja'],
    ]);
    expect(res.body[0]).toMatchObject({ pedidoId: pagado.id, estado: 'pendiente', intentos: 0 });
    expect(res.body[0].contenido).toContain('Chumblún');
    // Lo de caja dice Cuenta o Comprobante de pago, nunca que sea una factura
    expect(res.body[1].contenido).toMatch(/CUENTA/);
    expect(res.body[2].contenido).toMatch(/COMPROBANTE DE PAGO/);
    expect(res.body[2].contenido).toContain('Este documento no es factura.');
  });

  it('filtra por impresora', async () => {
    await pedidoPagado();
    const cocina = await agente.pendientes({ impresora: 'cocina' });
    expect(cocina.body.map((x) => x.tipo)).toEqual(['comanda']);
    const caja = await agente.pendientes({ impresora: 'caja' });
    expect(caja.body.map((x) => x.tipo)).toEqual(['cuenta', 'comprobante']);
  });

  it('un trabajo impreso ya no vuelve a salir, aunque el agente lo confirme dos veces', async () => {
    await pedidoEnviado();
    const [trabajo] = (await agente.pendientes()).body;

    const primera = await agente.marcar(trabajo.id, { estado: 'impreso' });
    expect(primera.status).toBe(200);
    expect(primera.body).toMatchObject({ estado: 'impreso' });
    expect(primera.body.impresoEn).toBeTruthy();

    const segunda = await agente.marcar(trabajo.id, { estado: 'impreso' });
    expect(segunda.status).toBe(200);
    expect(segunda.body.impresoEn).toBe(primera.body.impresoEn);

    expect((await agente.pendientes()).body).toEqual([]);
  });

  it('con la impresora apagada el trabajo queda en la cola con el error y sale al reintentar', async () => {
    await pedidoEnviado();
    const [trabajo] = (await agente.pendientes()).body;

    for (let i = 1; i <= 2; i++) {
      const res = await agente.marcar(trabajo.id, {
        estado: 'error',
        error: 'La impresora de cocina no responde',
      });
      expect(res.body).toMatchObject({
        estado: 'error',
        intentos: i,
        ultimoError: 'La impresora de cocina no responde',
      });
    }
    // Sigue en la cola: no se pierde
    const sigue = (await agente.pendientes()).body;
    expect(sigue).toEqual([expect.objectContaining({ id: trabajo.id, estado: 'error' })]);

    // Al prenderla, sale y se limpia el error
    const listo = await agente.marcar(trabajo.id, { estado: 'impreso' });
    expect(listo.body).toMatchObject({ estado: 'impreso', ultimoError: null });
  });

  it('un error que llega después de impreso no lo devuelve a la cola', async () => {
    await pedidoEnviado();
    const [trabajo] = (await agente.pendientes()).body;
    await agente.marcar(trabajo.id, { estado: 'impreso' });
    const res = await agente.marcar(trabajo.id, { estado: 'error', error: 'tarde' });
    expect(res.body.estado).toBe('impreso');
  });

  it('un trabajo que no existe → 404', async () => {
    expect((await agente.marcar(999999, { estado: 'impreso' })).status).toBe(404);
  });

  it.each([
    ['estado inventado', 1, { estado: 'quemado' }],
    ['error sin descripción', 1, { estado: 'error' }],
    ['error vacío', 1, { estado: 'error', error: '   ' }],
    ['error muy largo', 1, { estado: 'error', error: 'x'.repeat(256) }],
    ['id con letras', 'abc', { estado: 'impreso' }],
    ['id cero', 0, { estado: 'impreso' }],
  ])('%s → 400', async (_caso, id, datos) => {
    expect((await agente.marcar(id, datos)).status).toBe(400);
  });

  it('una impresora inventada → 400', async () => {
    expect((await agente.pendientes({ impresora: 'bar' })).status).toBe(400);
  });

  describe('Clave del agente', () => {
    it('sin clave o con una clave equivocada → 401', async () => {
      expect((await agente.pendientes({}, null)).status).toBe(401);
      expect((await agente.pendientes({}, 'otra-clave-cualquiera')).status).toBe(401);
      expect((await agente.marcar(1, { estado: 'impreso' }, null)).status).toBe(401);
    });

    it('un usuario con sesión, aunque sea el propietario, no entra con su token → 401', async () => {
      const res = await como('propietario').get('/api/impresion/pendientes');
      expect(res.status).toBe(401);
    });

    it('si el servidor no tiene la clave configurada (o es muy corta) → 503', async () => {
      delete process.env.CLAVE_AGENTE_IMPRESION;
      expect((await agente.pendientes({}, 'lo-que-sea-largo-aqui')).status).toBe(503);
      process.env.CLAVE_AGENTE_IMPRESION = 'corta';
      expect((await agente.pendientes({}, 'corta')).status).toBe(503);
    });
  });
});

describe('Estado de las impresoras (aviso en pantalla)', () => {
  it('cuenta pendientes y errores por impresora y sabe si el agente está conectado', async () => {
    await pedidoPagado();
    let res = await como('mesero').get('/api/impresion/estado');
    expect(res.status).toBe(200);
    expect(res.body.cocina).toMatchObject({ pendientes: 1, conError: 0, agenteConectado: false });
    expect(res.body.caja).toMatchObject({ pendientes: 2, agenteConectado: false });

    // El agente consulta la cocina y falla al imprimir
    const [comanda] = (await agente.pendientes({ impresora: 'cocina' })).body;
    await agente.marcar(comanda.id, { estado: 'error', error: 'Sin papel' });

    res = await como('cajero').get('/api/impresion/estado');
    expect(res.body.cocina).toMatchObject({
      pendientes: 0,
      conError: 1,
      ultimoError: 'Sin papel',
      agenteConectado: true,
    });
    expect(res.body.caja.agenteConectado).toBe(false); // no ha consultado la caja
  });

  it('sin sesión → 401', async () => {
    expect((await request(app).get('/api/impresion/estado')).status).toBe(401);
  });
});

describe('Reimprimir', () => {
  it('la comanda vuelve a la cola de cocina marcada como REIMPRESIÓN, a nombre de quien la pidió', async () => {
    const pedido = await pedidoEnviado();
    const res = await como('mesero').post('/api/impresion/reimprimir', {
      pedidoId: pedido.id,
      tipo: 'comanda',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tipo: 'comanda', impresora: 'cocina', pedidoId: pedido.id });

    const [[trabajo]] = await pool.query(
      `SELECT t.contenido, u.usuario FROM trabajo_impresion t
         JOIN usuario u ON u.id = t.solicitado_por WHERE t.id = ?`,
      [res.body.id],
    );
    expect(trabajo.contenido.startsWith('*** REIMPRESIÓN ***\n')).toBe(true);
    expect(trabajo.contenido).toContain('Chumblún');
    expect(trabajo.usuario).toBe('impresion.mesero');
  });

  it('la cuenta y el comprobante van a la impresora de caja', async () => {
    const pedido = await pedidoPagado();
    const cuenta = await como('cajero').post('/api/impresion/reimprimir', {
      pedidoId: pedido.id,
      tipo: 'cuenta',
    });
    const comprobante = await como('cajero').post('/api/impresion/reimprimir', {
      pedidoId: pedido.id,
      tipo: 'comprobante',
    });
    expect(cuenta.body.impresora).toBe('caja');
    expect(comprobante.status).toBe(201);
    expect(comprobante.body.impresora).toBe('caja');
  });

  it('no deja reimprimir lo que todavía no existe → 409', async () => {
    const pedido = await pedidoEnviado(); // abierto: sin cuenta ni comprobante
    for (const tipo of ['cuenta', 'comprobante']) {
      const res = await como('propietario').post('/api/impresion/reimprimir', {
        pedidoId: pedido.id,
        tipo,
      });
      expect(res.status).toBe(409);
    }
  });

  it('un mesero no puede reimprimir el comprobante → 403', async () => {
    const pedido = await pedidoPagado();
    const res = await como('mesero').post('/api/impresion/reimprimir', {
      pedidoId: pedido.id,
      tipo: 'comprobante',
    });
    expect(res.status).toBe(403);
  });

  it('pedido que no existe → 404; datos inválidos → 400; sin sesión → 401', async () => {
    expect(
      (
        await como('cajero').post('/api/impresion/reimprimir', {
          pedidoId: 999999,
          tipo: 'comanda',
        })
      ).status,
    ).toBe(404);
    expect(
      (await como('cajero').post('/api/impresion/reimprimir', { pedidoId: 1, tipo: 'factura' }))
        .status,
    ).toBe(400);
    expect(
      (await como('cajero').post('/api/impresion/reimprimir', { pedidoId: 'x', tipo: 'comanda' }))
        .status,
    ).toBe(400);
    expect(
      (await request(app).post('/api/impresion/reimprimir').send({ pedidoId: 1, tipo: 'comanda' }))
        .status,
    ).toBe(401);
  });
});
