const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');

afterAll(() => pool.end());

describe('GET /api/salud', () => {
  it('responde 200 con el estado de la API', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
    expect(['conectada', 'sin conexión']).toContain(res.body.baseDeDatos);
  });

  it('responde 404 en una ruta que no existe', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
  });
});
