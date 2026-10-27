const { CLAVE, crearCuenta, tokenDe, app, pool, request } = require('./apoyo/ayudas');

afterAll(() => pool.end());

let token;
let idPropietario;
beforeAll(async () => {
  idPropietario = await crearCuenta('admin.usuarios', 'propietario');
  await pool.query("DELETE FROM usuario WHERE usuario LIKE 'nuevo.%'");
  token = await tokenDe('admin.usuarios');
});

const conToken = (req) => req.set('Authorization', `Bearer ${token}`);
const login = (usuario, contrasena) =>
  request(app).post('/api/auth/login').send({ usuario, contrasena });

describe('/api/usuarios (propietario)', () => {
  it('lista las cuentas sin exponer las contraseñas', async () => {
    const res = await conToken(request(app).get('/api/usuarios'));
    expect(res.status).toBe(200);
    expect(res.body.usuarios.length).toBeGreaterThanOrEqual(3);
    for (const u of res.body.usuarios) expect(u).not.toHaveProperty('contrasena_hash');
  });

  it('lista los tres roles', async () => {
    const res = await conToken(request(app).get('/api/usuarios/roles'));
    expect(res.body.roles.map((r) => r.nombre)).toEqual(['propietario', 'cajero', 'mesero']);
  });

  it('crea una cuenta que ya puede iniciar sesión, con la contraseña guardada como hash', async () => {
    const res = await conToken(request(app).post('/api/usuarios')).send({
      nombre: 'Yesica Mesera',
      usuario: 'Nuevo.Yesica',
      contrasena: 'Segura2026',
      rol: 'mesero',
    });
    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({
      usuario: 'nuevo.yesica',
      rol: 'mesero',
      activo: true,
    });

    const [[fila]] = await pool.query('SELECT contrasena_hash FROM usuario WHERE usuario = ?', [
      'nuevo.yesica',
    ]);
    expect(fila.contrasena_hash).toMatch(/^\$2[aby]\$/);
    expect(fila.contrasena_hash).not.toContain('Segura2026');

    expect((await login('nuevo.yesica', 'Segura2026')).status).toBe(200);
  });

  it('no deja crear dos cuentas con el mismo usuario (409)', async () => {
    const res = await conToken(request(app).post('/api/usuarios')).send({
      nombre: 'Otra',
      usuario: 'nuevo.yesica',
      contrasena: 'Segura2026',
      rol: 'cajero',
    });
    expect(res.status).toBe(409);
  });

  it.each([
    [{ nombre: 'X', usuario: 'nuevo.x', contrasena: 'Segura2026', rol: 'mesero' }, 'nombre'],
    [
      { nombre: 'Sin clave', usuario: 'nuevo.corta', contrasena: '123', rol: 'mesero' },
      'contrasena',
    ],
    [{ nombre: 'Rol raro', usuario: 'nuevo.rol', contrasena: 'Segura2026', rol: 'admin' }, 'rol'],
    [
      { nombre: 'Con tilde', usuario: 'nuevo.josé', contrasena: 'Segura2026', rol: 'mesero' },
      'usuario',
    ],
  ])('valida los datos (%o) y responde 400', async (datos, campo) => {
    const res = await conToken(request(app).post('/api/usuarios')).send(datos);
    expect(res.status).toBe(400);
    expect(res.body.campo).toBe(campo);
  });

  it('edita el nombre y el rol', async () => {
    const id = await crearCuenta('nuevo.edita', 'mesero');
    const res = await conToken(request(app).put(`/api/usuarios/${id}`)).send({
      nombre: 'Cajera Nueva',
      rol: 'cajero',
    });
    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ nombre: 'Cajera Nueva', rol: 'cajero' });
  });

  it('cambiar la contraseña también desbloquea la cuenta', async () => {
    const id = await crearCuenta('nuevo.bloqueada', 'mesero');
    for (let i = 0; i < 5; i++) await login('nuevo.bloqueada', 'mala');
    expect((await login('nuevo.bloqueada', CLAVE)).status).toBe(423);

    await conToken(request(app).put(`/api/usuarios/${id}`)).send({ contrasena: 'NuevaClave2026' });
    expect((await login('nuevo.bloqueada', 'NuevaClave2026')).status).toBe(200);
  });

  it('desactivar una cuenta le impide entrar; activarla se lo devuelve', async () => {
    const id = await crearCuenta('nuevo.desactiva', 'mesero');
    await conToken(request(app).put(`/api/usuarios/${id}`)).send({ activo: false });
    expect((await login('nuevo.desactiva', CLAVE)).status).toBe(403);
    await conToken(request(app).put(`/api/usuarios/${id}`)).send({ activo: true });
    expect((await login('nuevo.desactiva', CLAVE)).status).toBe(200);
  });

  it('el propietario no puede desactivarse ni quitarse el rol a sí mismo', async () => {
    let res = await conToken(request(app).put(`/api/usuarios/${idPropietario}`)).send({
      activo: false,
    });
    expect(res.status).toBe(400);
    res = await conToken(request(app).put(`/api/usuarios/${idPropietario}`)).send({
      rol: 'mesero',
    });
    expect(res.status).toBe(400);
  });

  it('responde 404 si la cuenta no existe', async () => {
    const res = await conToken(request(app).put('/api/usuarios/999999')).send({
      nombre: 'Nadie aquí',
    });
    expect(res.status).toBe(404);
  });
});
