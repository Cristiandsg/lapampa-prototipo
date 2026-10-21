const { CLAVE, crearCuenta, tokenDe, tokenVencido, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

const login = (usuario, contrasena) =>
  request(app).post('/api/auth/login').send({ usuario, contrasena });

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await crearCuenta('prueba.mesero', 'mesero');
    await crearCuenta('prueba.inactivo', 'cajero', { activo: false });
  });

  it('con credenciales correctas devuelve el token y el rol', async () => {
    const res = await login('prueba.mesero', CLAVE);
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ usuario: 'prueba.mesero', rol: 'mesero' });
    expect(res.body.usuario).not.toHaveProperty('contrasena_hash');
  });

  it('acepta el usuario con mayúsculas o espacios de más', async () => {
    const res = await login('  Prueba.Mesero ', CLAVE);
    expect(res.status).toBe(200);
  });

  it('los usuarios de prueba del seed entran con LaPampa2026*', async () => {
    for (const usuario of ['propietario', 'cajero', 'mesero']) {
      const res = await login(usuario, 'LaPampa2026*');
      expect(res.status).toBe(200);
      expect(res.body.usuario.rol).toBe(usuario);
    }
  });

  it('con contraseña errada responde 401 sin decir cuál dato está mal', async () => {
    const res = await login('prueba.mesero', 'otra-clave');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Usuario o contraseña incorrectos.');
  });

  it('con un usuario que no existe responde el mismo 401', async () => {
    const res = await login('no.existe', CLAVE);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Usuario o contraseña incorrectos.');
  });

  it('sin usuario o sin contraseña responde 400', async () => {
    expect((await login('', CLAVE)).status).toBe(400);
    expect((await login('prueba.mesero', '')).status).toBe(400);
  });

  it('un usuario desactivado no puede entrar (403)', async () => {
    const res = await login('prueba.inactivo', CLAVE);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/desactivada/);
  });
});

describe('Bloqueo por intentos fallidos', () => {
  beforeEach(() => crearCuenta('prueba.bloqueo', 'mesero'));

  it('tras 5 intentos fallidos seguidos la cuenta se bloquea 10 minutos', async () => {
    for (let i = 1; i <= 4; i++) {
      expect((await login('prueba.bloqueo', 'mala')).status).toBe(401);
    }
    const quinto = await login('prueba.bloqueo', 'mala');
    expect(quinto.status).toBe(423);
    expect(quinto.body.error).toMatch(/10 minutos/);

    // Bloqueada, ni siquiera la contraseña correcta deja entrar
    const correcta = await login('prueba.bloqueo', CLAVE);
    expect(correcta.status).toBe(423);

    const [[fila]] = await pool.query(
      'SELECT TIMESTAMPDIFF(MINUTE, NOW(), bloqueado_hasta) AS min FROM usuario WHERE usuario = ?',
      ['prueba.bloqueo'],
    );
    expect(fila.min).toBeGreaterThanOrEqual(9);
  });

  it('cuando pasa el bloqueo vuelve a entrar y el contador se reinicia', async () => {
    for (let i = 1; i <= 5; i++) await login('prueba.bloqueo', 'mala');
    // Simula que pasaron los 10 minutos
    await pool.query(
      'UPDATE usuario SET bloqueado_hasta = NOW() - INTERVAL 1 SECOND WHERE usuario = ?',
      ['prueba.bloqueo'],
    );
    expect((await login('prueba.bloqueo', CLAVE)).status).toBe(200);
    const [[fila]] = await pool.query(
      'SELECT intentos_fallidos, bloqueado_hasta FROM usuario WHERE usuario = ?',
      ['prueba.bloqueo'],
    );
    expect(fila).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
  });

  it('un ingreso correcto antes del quinto intento reinicia la cuenta de fallos', async () => {
    for (let i = 1; i <= 4; i++) await login('prueba.bloqueo', 'mala');
    expect((await login('prueba.bloqueo', CLAVE)).status).toBe(200);
    for (let i = 1; i <= 4; i++) {
      expect((await login('prueba.bloqueo', 'mala')).status).toBe(401);
    }
  });
});

describe('GET /api/auth/yo', () => {
  let id;
  beforeAll(async () => {
    id = await crearCuenta('prueba.yo', 'cajero');
  });

  it('sin token responde 401', async () => {
    expect((await request(app).get('/api/auth/yo')).status).toBe(401);
  });

  it('con un token inventado responde 401', async () => {
    const res = await request(app).get('/api/auth/yo').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('con un token vencido responde 401 y pide volver a iniciar sesión', async () => {
    const res = await request(app)
      .get('/api/auth/yo')
      .set('Authorization', `Bearer ${tokenVencido(id)}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/venció/);
  });

  it('con un token válido devuelve quién soy', async () => {
    const token = await tokenDe('prueba.yo');
    const res = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ id, rol: 'cajero' });
  });

  it('si desactivan la cuenta, su token deja de servir de inmediato', async () => {
    const token = await tokenDe('prueba.yo');
    await pool.query('UPDATE usuario SET activo = FALSE WHERE id = ?', [id]);
    const res = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
