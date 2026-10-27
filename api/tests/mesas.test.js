// HU03 — Crear y administrar las mesas de la jornada
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
const ids = {};
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    ids[rol] = await crearCuenta(`mesas.${rol}`, rol);
    t[rol] = await tokenDe(`mesas.${rol}`);
  }
});

beforeEach(async () => {
  // Cada prueba arranca sin mesas activas
  await pool.query('DELETE FROM trabajo_impresion');
  await pool.query('DELETE FROM detalle_pedido');
  await pool.query('DELETE FROM pedido');
  await pool.query('UPDATE mesa SET activa = FALSE');
});

const como = (rol) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${t[rol]}`),
  post: (url, datos) => request(app).post(url).set('Authorization', `Bearer ${t[rol]}`).send(datos),
  patch: (url, datos) =>
    request(app).patch(url).set('Authorization', `Bearer ${t[rol]}`).send(datos),
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${t[rol]}`),
});

const crearMesa = async (nombre, rol = 'mesero') =>
  (await como(rol).post('/api/mesas', { nombre })).body;

// Simula lo que hará la HU04: un pedido abierto en la mesa
async function abrirPedido(mesaId) {
  await pool.query(
    "INSERT INTO pedido (canal, mesa_id, mesero_id, subtotal) VALUES ('mesa', ?, ?, 52000)",
    [mesaId, ids.mesero],
  );
  await pool.query("UPDATE mesa SET estado = 'ocupada' WHERE id = ?", [mesaId]);
}

describe('Crear mesas', () => {
  it('el mesero crea una mesa con el nombre que quiera', async () => {
    const res = await como('mesero').post('/api/mesas', { nombre: '  Cumpleaños   Andrea ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Cumpleaños Andrea', estado: 'libre' });
  });

  it('el propietario también puede crear mesas', async () => {
    expect((await como('propietario').post('/api/mesas', { nombre: 'Barra' })).status).toBe(201);
  });

  it('el cajero no crea mesas (403), pero sí las ve', async () => {
    await crearMesa('Terraza 1');
    expect((await como('cajero').post('/api/mesas', { nombre: 'Caja' })).status).toBe(403);
    const lista = await como('cajero').get('/api/mesas');
    expect(lista.status).toBe(200);
    expect(lista.body.map((m) => m.nombre)).toEqual(['Terraza 1']);
  });

  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/mesas')).status).toBe(401);
  });

  it.each([[''], ['   '], [null]])('rechaza un nombre vacío (%p) con 400', async (nombre) => {
    const res = await como('mesero').post('/api/mesas', { nombre });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre de la mesa/);
  });

  it('rechaza un nombre de más de 40 caracteres', async () => {
    expect((await como('mesero').post('/api/mesas', { nombre: 'x'.repeat(41) })).status).toBe(400);
  });

  it('no deja dos mesas activas con el mismo nombre, sin importar mayúsculas ni tildes (409)', async () => {
    await crearMesa('Terraza 2');
    for (const nombre of ['Terraza 2', 'terraza 2', 'TERRAZA 2']) {
      const res = await como('mesero').post('/api/mesas', { nombre });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Ya hay una mesa activa/);
    }
  });

  it('el nombre se puede volver a usar cuando la mesa anterior se eliminó', async () => {
    const vieja = await crearMesa('Patio');
    await como('mesero').del(`/api/mesas/${vieja.id}`);
    expect((await como('mesero').post('/api/mesas', { nombre: 'Patio' })).status).toBe(201);
  });
});

describe('Listar mesas', () => {
  it('muestra solo las activas, en orden de creación, con su estado y quién la creó', async () => {
    await crearMesa('Terraza 1');
    const borrada = await crearMesa('Borrada');
    await crearMesa('Ventana', 'propietario');
    await como('mesero').del(`/api/mesas/${borrada.id}`);

    const res = await como('mesero').get('/api/mesas');
    expect(res.body.map((m) => m.nombre)).toEqual(['Terraza 1', 'Ventana']);
    expect(res.body[0]).toMatchObject({
      estado: 'libre',
      creada_por: 'Prueba mesas.mesero',
      pedido: null,
    });
  });

  it('una mesa ocupada trae el resumen de su pedido abierto', async () => {
    const mesa = await crearMesa('Terraza 2');
    await abrirPedido(mesa.id);
    const [encontrada] = (await como('mesero').get('/api/mesas')).body;
    expect(encontrada.estado).toBe('ocupada');
    expect(encontrada.pedido).toMatchObject({ total: 52000, minutos: 0 });
  });
});

describe('Renombrar mesas', () => {
  it('renombra una mesa libre', async () => {
    const mesa = await crearMesa('Mesa 1');
    const res = await como('mesero').patch(`/api/mesas/${mesa.id}`, { nombre: 'Terraza 3' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Terraza 3');
  });

  it('no deja renombrar con el nombre de otra mesa activa (409)', async () => {
    await crearMesa('Barra');
    const mesa = await crearMesa('Patio');
    expect((await como('mesero').patch(`/api/mesas/${mesa.id}`, { nombre: 'barra' })).status).toBe(
      409,
    );
  });

  it('no deja renombrar una mesa con pedido abierto (409)', async () => {
    const mesa = await crearMesa('Terraza 1');
    await abrirPedido(mesa.id);
    const res = await como('mesero').patch(`/api/mesas/${mesa.id}`, { nombre: 'Otra' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pedido abierto/);
  });

  it('responde 404 si la mesa no existe', async () => {
    expect((await como('mesero').patch('/api/mesas/999999', { nombre: 'X' })).status).toBe(404);
  });
});

describe('Eliminar mesas', () => {
  it('eliminar una mesa libre la desactiva y no la borra', async () => {
    const mesa = await crearMesa('Terraza 1');
    expect((await como('mesero').del(`/api/mesas/${mesa.id}`)).status).toBe(200);
    const [[fila]] = await pool.query('SELECT activa FROM mesa WHERE id = ?', [mesa.id]);
    expect(fila.activa).toBe(0);
  });

  it('una mesa con pedido abierto no se puede eliminar (criterio de aceptación)', async () => {
    const mesa = await crearMesa('Cumpleaños Andrea');
    await abrirPedido(mesa.id);
    const res = await como('mesero').del(`/api/mesas/${mesa.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/pedido abierto/);
    expect((await como('mesero').get('/api/mesas')).body).toHaveLength(1);
  });

  it('el cajero no puede eliminar mesas (403)', async () => {
    const mesa = await crearMesa('Barra');
    expect((await como('cajero').del(`/api/mesas/${mesa.id}`)).status).toBe(403);
  });

  it('eliminar dos veces la misma mesa responde 404', async () => {
    const mesa = await crearMesa('Barra');
    await como('mesero').del(`/api/mesas/${mesa.id}`);
    expect((await como('mesero').del(`/api/mesas/${mesa.id}`)).status).toBe(404);
  });
});

describe('Cerrar la jornada: quitar mesas libres', () => {
  it('quita las libres y deja las que tienen pedido abierto', async () => {
    await crearMesa('Terraza 1');
    await crearMesa('Terraza 2');
    const ocupada = await crearMesa('Barra');
    await abrirPedido(ocupada.id);

    const res = await como('mesero').post('/api/mesas/quitar-libres');
    expect(res.body).toEqual({ cantidad: 2 });
    expect((await como('mesero').get('/api/mesas')).body.map((m) => m.nombre)).toEqual(['Barra']);
  });
});

describe('Trazabilidad', () => {
  it('queda registrado quién creó, renombró y eliminó cada mesa', async () => {
    const mesa = await crearMesa('Mesa A');
    await como('mesero').patch(`/api/mesas/${mesa.id}`, { nombre: 'Mesa B' });
    await como('propietario').del(`/api/mesas/${mesa.id}`);

    const [filas] = await pool.query(
      "SELECT accion, valor_anterior, valor_nuevo, usuario_id FROM historial_cambio WHERE entidad = 'mesa' AND entidad_id = ? ORDER BY id",
      [mesa.id],
    );
    expect(filas).toEqual([
      { accion: 'crear', valor_anterior: null, valor_nuevo: 'Mesa A', usuario_id: ids.mesero },
      {
        accion: 'renombrar',
        valor_anterior: 'Mesa A',
        valor_nuevo: 'Mesa B',
        usuario_id: ids.mesero,
      },
      {
        accion: 'eliminar',
        valor_anterior: 'Mesa B',
        valor_nuevo: null,
        usuario_id: ids.propietario,
      },
    ]);
  });
});
