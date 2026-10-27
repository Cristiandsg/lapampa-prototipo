// Criterio de aceptación de HU01: un mesero no puede llamar las rutas de caja ni de reportes.
const { crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const tokens = {};
beforeAll(async () => {
  await crearCuenta('permiso.mesero', 'mesero');
  await crearCuenta('permiso.cajero', 'cajero');
  await crearCuenta('permiso.propietario', 'propietario');
  for (const rol of ['mesero', 'cajero', 'propietario'])
    tokens[rol] = await tokenDe(`permiso.${rol}`);
});

const pedir = (ruta, rol) => request(app).get(ruta).set('Authorization', `Bearer ${tokens[rol]}`);

describe('Permisos por rol', () => {
  it.each(['/api/caja', '/api/reportes', '/api/usuarios'])(
    'un mesero recibe 403 en %s',
    async (ruta) => {
      const res = await pedir(ruta, 'mesero');
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/permiso/);
    },
  );

  it('un cajero entra a caja pero no a reportes ni a usuarios', async () => {
    expect((await pedir('/api/caja', 'cajero')).status).not.toBe(403);
    expect((await pedir('/api/reportes', 'cajero')).status).toBe(403);
    expect((await pedir('/api/usuarios', 'cajero')).status).toBe(403);
  });

  it('el propietario entra a caja, reportes y usuarios', async () => {
    expect((await pedir('/api/caja', 'propietario')).status).not.toBe(403);
    expect((await pedir('/api/reportes', 'propietario')).status).not.toBe(403);
    expect((await pedir('/api/usuarios', 'propietario')).status).toBe(200);
  });

  it.each(['/api/caja', '/api/reportes', '/api/usuarios'])(
    'sin sesión, %s responde 401',
    async (ruta) => {
      expect((await request(app).get(ruta)).status).toBe(401);
    },
  );

  it('la ruta de salud sigue siendo pública', async () => {
    expect((await request(app).get('/api/salud')).status).toBe(200);
  });
});
