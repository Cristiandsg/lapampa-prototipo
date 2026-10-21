import { vi } from 'vitest';
import api, { configurarSesion, mensajeDeError } from './api';

// El manejador de errores que registró el cliente HTTP
const alFallar = api.interceptors.response.handlers.at(-1).rejected;
const alPedir = api.interceptors.request.handlers.at(-1).fulfilled;

describe('Cliente HTTP y sesión (HU01)', () => {
  it('manda el token en el encabezado Authorization', () => {
    configurarSesion({ token: () => 'abc', vencida: vi.fn() });
    const config = alPedir({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc');
  });

  it('un 401 fuera del login cierra la sesión con el mensaje de la API', async () => {
    const vencida = vi.fn();
    configurarSesion({ token: () => 'abc', vencida });
    const error = {
      config: { url: '/usuarios' },
      response: { status: 401, data: { error: 'Tu cuenta no está activa.' } },
    };
    await expect(alFallar(error)).rejects.toBe(error);
    expect(vencida).toHaveBeenCalledWith('Tu cuenta no está activa.');
  });

  it('un 401 en el login no cierra nada (es contraseña errada)', async () => {
    const vencida = vi.fn();
    configurarSesion({ token: () => null, vencida });
    await alFallar({ config: { url: '/auth/login' }, response: { status: 401, data: {} } }).catch(
      () => {},
    );
    expect(vencida).not.toHaveBeenCalled();
  });

  it('traduce los errores a mensajes en español', () => {
    expect(mensajeDeError({ response: { data: { error: 'Cuenta bloqueada.' } } })).toBe(
      'Cuenta bloqueada.',
    );
    expect(mensajeDeError({ code: 'ECONNABORTED' })).toMatch(/tardó demasiado/);
    expect(mensajeDeError({})).toMatch(/No hay conexión/);
  });
});
