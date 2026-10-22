// HU02 — Gestión de la carta digital
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const t = {};
let categoriaId;
beforeAll(async () => {
  for (const rol of ['propietario', 'cajero', 'mesero']) {
    await crearCuenta(`carta.${rol}`, rol);
    t[rol] = await tokenDe(`carta.${rol}`);
  }
  await pool.query("DELETE FROM producto WHERE nombre LIKE 'Prueba %'");
  await pool.query("DELETE FROM categoria WHERE nombre LIKE 'Prueba %'");
  const res = await request(app)
    .post('/api/categorias')
    .set('Authorization', `Bearer ${t.propietario}`)
    .send({ nombre: 'Prueba Mariscos', orden: 99 });
  categoriaId = res.body.id;
});

const como = (rol) => ({
  get: (url) => request(app).get(url).set('Authorization', `Bearer ${t[rol]}`),
  post: (url, datos) => request(app).post(url).set('Authorization', `Bearer ${t[rol]}`).send(datos),
  patch: (url, datos) =>
    request(app).patch(url).set('Authorization', `Bearer ${t[rol]}`).send(datos),
  del: (url) => request(app).delete(url).set('Authorization', `Bearer ${t[rol]}`),
});

async function crearProducto(nombre, precio = 20000) {
  const res = await como('propietario').post('/api/productos', { categoriaId, nombre, precio });
  return res.body;
}

describe('Consultar la carta', () => {
  it('cualquier rol con sesión ve los productos en el orden de la carta', async () => {
    for (const rol of ['mesero', 'cajero', 'propietario']) {
      const res = await como(rol).get('/api/productos');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(58);
    }
  });

  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/productos')).status).toBe(401);
    expect((await request(app).get('/api/categorias')).status).toBe(401);
  });

  it('filtra por categoría', async () => {
    await crearProducto('Prueba Filtro');
    const res = await como('mesero').get(`/api/productos?categoria_id=${categoriaId}`);
    expect(res.body.map((p) => p.nombre)).toContain('Prueba Filtro');
    expect(res.body.every((p) => p.categoria_id === categoriaId)).toBe(true);
  });
});

describe('Crear productos', () => {
  it('el propietario crea un producto', async () => {
    const res = await como('propietario').post('/api/productos', {
      categoriaId,
      nombre: 'Prueba Cazuela',
      descripcion: 'De mariscos',
      precio: '45000',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombre: 'Prueba Cazuela',
      precio: 45000,
      activo: true,
      agotado_hoy: false,
    });
  });

  it.each(['mesero', 'cajero'])('el %s no puede crear productos (403)', async (rol) => {
    const res = await como(rol).post('/api/productos', {
      categoriaId,
      nombre: 'Prueba Prohibido',
      precio: 1000,
    });
    expect(res.status).toBe(403);
  });

  it.each([0, -5000, 'abc'])('rechaza el precio %p (400)', async (precio) => {
    const res = await como('propietario').post('/api/productos', {
      categoriaId,
      nombre: 'Prueba Precio',
      precio,
    });
    expect(res.status).toBe(400);
    expect(res.body.campo).toBe('precio');
  });

  it('rechaza un nombre que ya existe (409)', async () => {
    const res = await como('propietario').post('/api/productos', {
      categoriaId,
      nombre: 'Chumblún',
      precio: 1000,
    });
    expect(res.status).toBe(409);
  });

  it('rechaza una categoría que no existe (400)', async () => {
    const res = await como('propietario').post('/api/productos', {
      categoriaId: 99999,
      nombre: 'Prueba Sin Cat',
      precio: 1000,
    });
    expect(res.status).toBe(400);
  });
});

describe('Editar, agotar y desactivar', () => {
  it('el propietario cambia el precio y el nombre', async () => {
    const p = await crearProducto('Prueba Editar', 10000);
    const res = await como('propietario').patch(`/api/productos/${p.id}`, {
      precio: 12000,
      nombre: 'Prueba Editado',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ precio: 12000, nombre: 'Prueba Editado' });
  });

  it.each(['mesero', 'cajero'])('el %s puede marcar "agotado hoy"', async (rol) => {
    const p = await crearProducto(`Prueba Agotado ${rol}`);
    const res = await como(rol).patch(`/api/productos/${p.id}`, { agotadoHoy: true });
    expect(res.status).toBe(200);
    expect(res.body.agotado_hoy).toBe(true);
  });

  it.each([
    ['mesero', { precio: 1000 }],
    ['mesero', { activo: false }],
    ['cajero', { nombre: 'Prueba Hackeado' }],
    ['cajero', { agotadoHoy: true, precio: 1 }],
  ])('el %s no puede cambiar %o (403) y el producto no cambia', async (rol, cambios) => {
    const p = await crearProducto(
      `Prueba Protegido ${rol} ${Object.keys(cambios).join('')}`,
      30000,
    );
    const res = await como(rol).patch(`/api/productos/${p.id}`, cambios);
    expect(res.status).toBe(403);
    const [[fila]] = await pool.query(
      'SELECT precio, activo, agotado_hoy FROM producto WHERE id = ?',
      [p.id],
    );
    expect(fila).toEqual({ precio: 30000, activo: 1, agotado_hoy: 0 });
  });

  it('valida los booleanos: "true" como texto responde 400 y no 500', async () => {
    const p = await crearProducto('Prueba Booleano');
    const res = await como('propietario').patch(`/api/productos/${p.id}`, { activo: 'true' });
    expect(res.status).toBe(400);
  });

  it('no existe borrar un producto: se desactiva', async () => {
    const p = await crearProducto('Prueba Borrar');
    expect((await como('propietario').del(`/api/productos/${p.id}`)).status).toBe(404);
    const res = await como('propietario').patch(`/api/productos/${p.id}`, { activo: false });
    expect(res.body.activo).toBe(false);
  });

  it('responde 404 si el producto no existe', async () => {
    expect(
      (await como('propietario').patch('/api/productos/999999', { precio: 1000 })).status,
    ).toBe(404);
  });
});

describe('Lo que se puede pedir (disponibles)', () => {
  it('excluye desactivados, agotados hoy y los de categorías desactivadas', async () => {
    const normal = await crearProducto('Prueba Normal');
    const agotado = await crearProducto('Prueba Agotado');
    const inactivo = await crearProducto('Prueba Inactivo');
    await como('mesero').patch(`/api/productos/${agotado.id}`, { agotadoHoy: true });
    await como('propietario').patch(`/api/productos/${inactivo.id}`, { activo: false });

    let nombres = (await como('mesero').get('/api/productos?disponibles=true')).body.map(
      (p) => p.nombre,
    );
    expect(nombres).toContain('Prueba Normal');
    expect(nombres).not.toContain('Prueba Agotado');
    expect(nombres).not.toContain('Prueba Inactivo');

    // El agotado sigue en la carta del propietario (no se desactivó)
    const todos = (await como('propietario').get('/api/productos?activos=true')).body.map(
      (p) => p.nombre,
    );
    expect(todos).toContain('Prueba Agotado');
    expect(todos).not.toContain('Prueba Inactivo');

    await como('propietario').patch(`/api/categorias/${categoriaId}`, { activa: false });
    nombres = (await como('mesero').get('/api/productos?disponibles=true')).body.map(
      (p) => p.nombre,
    );
    expect(nombres).not.toContain('Prueba Normal');
    await como('propietario').patch(`/api/categorias/${categoriaId}`, { activa: true });
    expect(normal.id).toBeGreaterThan(0);
  });
});

describe('Criterio de aceptación: el precio de los pedidos ya registrados no cambia', () => {
  it('cambiar el precio no altera el detalle de un pedido existente', async () => {
    const p = await crearProducto('Prueba Precio Historico', 40000);
    const [[mesero]] = await pool.query("SELECT id FROM usuario WHERE usuario = 'carta.mesero'");
    await pool.query("DELETE FROM mesa WHERE nombre = 'Prueba Mesa HU02'");
    const [mesa] = await pool.query(
      "INSERT INTO mesa (nombre, creada_por) VALUES ('Prueba Mesa HU02', ?)",
      [mesero.id],
    );
    const [pedido] = await pool.query(
      "INSERT INTO pedido (canal, mesa_id, mesero_id) VALUES ('mesa', ?, ?)",
      [mesa.insertId, mesero.id],
    );
    await pool.query(
      'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, 1, ?)',
      [pedido.insertId, p.id, p.precio],
    );

    await como('propietario').patch(`/api/productos/${p.id}`, { precio: 45000 });

    const [[detalle]] = await pool.query(
      'SELECT precio_unitario FROM detalle_pedido WHERE pedido_id = ?',
      [pedido.insertId],
    );
    expect(detalle.precio_unitario).toBe(40000);
    const [[producto]] = await pool.query('SELECT precio FROM producto WHERE id = ?', [p.id]);
    expect(producto.precio).toBe(45000);
  });
});

describe('Categorías', () => {
  it('el propietario crea, renombra y desactiva una categoría', async () => {
    const creada = await como('propietario').post('/api/categorias', { nombre: 'Prueba Postres' });
    expect(creada.status).toBe(201);
    const editada = await como('propietario').patch(`/api/categorias/${creada.body.id}`, {
      nombre: 'Prueba Dulces',
      activa: false,
    });
    expect(editada.body).toMatchObject({ nombre: 'Prueba Dulces', activa: false });
  });

  it('el mesero no puede crear categorías (403)', async () => {
    expect((await como('mesero').post('/api/categorias', { nombre: 'Prueba X' })).status).toBe(403);
  });

  it('no deja nombres repetidos (409)', async () => {
    expect(
      (await como('propietario').post('/api/categorias', { nombre: 'Prueba Mariscos' })).status,
    ).toBe(409);
  });

  it('una categoría vacía se puede eliminar; con productos no (409)', async () => {
    const vacia = await como('propietario').post('/api/categorias', { nombre: 'Prueba Vacía' });
    expect((await como('propietario').del(`/api/categorias/${vacia.body.id}`)).status).toBe(200);
    const res = await como('propietario').del(`/api/categorias/${categoriaId}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/desactívala/);
  });
});
