import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from './App';
import * as api from './services/api';

vi.mock('./services/api', async (original) => ({
  ...(await original()),
  obtenerSalud: vi.fn().mockResolvedValue({ estado: 'ok', baseDeDatos: 'conectada' }),
  iniciarSesion: vi.fn(),
  quienSoy: vi.fn(),
  listarUsuarios: vi.fn(),
  crearUsuario: vi.fn(),
  actualizarUsuario: vi.fn(),
}));

// Token con el formato de un JWT; solo importa el campo "exp" (en segundos).
function tokenFalso(segundosDeVida) {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + segundosDeVida })}.firma`;
}

const CUENTAS = {
  mesero: { id: 3, nombre: 'Mesero de prueba', usuario: 'mesero', rol: 'mesero' },
  cajero: { id: 2, nombre: 'Cajero de prueba', usuario: 'cajero', rol: 'cajero' },
  propietario: {
    id: 1,
    nombre: 'Propietario de prueba',
    usuario: 'propietario',
    rol: 'propietario',
  },
};

function conSesion(rol, segundos = 3600) {
  localStorage.setItem(
    'lapampa.sesion',
    JSON.stringify({ token: tokenFalso(segundos), usuario: CUENTAS[rol] }),
  );
  api.quienSoy.mockResolvedValue(CUENTAS[rol]);
}

function abrir(ruta = '/') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('Ingreso (HU01)', () => {
  it('sin sesión, cualquier pantalla interna manda al ingreso', async () => {
    abrir('/usuarios');
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('con credenciales correctas entra al menú de su rol', async () => {
    const token = tokenFalso(3600);
    api.iniciarSesion.mockResolvedValue({ token, usuario: CUENTAS.mesero });
    api.quienSoy.mockResolvedValue(CUENTAS.mesero);
    const usuario = userEvent.setup();
    abrir('/ingresar');

    await usuario.type(screen.getByLabelText('Usuario'), 'mesero');
    await usuario.type(screen.getByLabelText('Contraseña'), 'LaPampa2026*');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('heading', { name: 'Hola, Mesero' })).toBeInTheDocument();
    expect(api.iniciarSesion).toHaveBeenCalledWith('mesero', 'LaPampa2026*');
    expect(JSON.parse(localStorage.getItem('lapampa.sesion')).token).toBe(token);
  });

  it('muestra el mensaje de la API cuando la contraseña está mal y limpia la contraseña', async () => {
    api.iniciarSesion.mockRejectedValue({
      response: { status: 401, data: { error: 'Usuario o contraseña incorrectos.' } },
    });
    const usuario = userEvent.setup();
    abrir('/ingresar');

    await usuario.type(screen.getByLabelText('Usuario'), 'mesero');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuario o contraseña incorrectos.');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
  });

  it('pide los dos datos antes de llamar a la API', async () => {
    const usuario = userEvent.setup();
    abrir('/ingresar');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Escribe tu usuario y tu contraseña.',
    );
    expect(api.iniciarSesion).not.toHaveBeenCalled();
  });

  it('el botón Mostrar deja ver la contraseña', async () => {
    const usuario = userEvent.setup();
    abrir('/ingresar');
    const clave = screen.getByLabelText('Contraseña');
    expect(clave).toHaveAttribute('type', 'password');
    await usuario.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(clave).toHaveAttribute('type', 'text');
  });
});

describe('Menú según el rol (HU01)', () => {
  const opcionesVisibles = () =>
    within(screen.getByRole('navigation', { name: 'Menú principal' }))
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.opcion-titulo').textContent);

  it('el mesero solo ve mesas y pedidos', async () => {
    conSesion('mesero');
    abrir('/');
    await screen.findByRole('heading', { name: 'Hola, Mesero' });
    expect(opcionesVisibles()).toEqual(['Mesas y pedidos']);
  });

  it('el cajero ve caja y domicilios, sin reportes ni usuarios', async () => {
    conSesion('cajero');
    abrir('/');
    await screen.findByRole('heading', { name: 'Hola, Cajero' });
    expect(opcionesVisibles()).toEqual(['Caja', 'Domicilios']);
  });

  it('el propietario ve todo y puede entrar a Usuarios', async () => {
    conSesion('propietario');
    abrir('/');
    await screen.findByRole('heading', { name: 'Hola, Propietario' });
    expect(opcionesVisibles()).toEqual([
      'Mesas y pedidos',
      'Carta',
      'Caja',
      'Domicilios',
      'Reportes',
      'Usuarios',
    ]);
    expect(screen.getByRole('link', { name: /Usuarios/ })).toHaveAttribute('href', '/usuarios');
  });

  it('un mesero que escribe /usuarios ve que no tiene permiso', async () => {
    conSesion('mesero');
    abrir('/usuarios');
    expect(await screen.findByText('Esta opción no es para tu rol')).toBeInTheDocument();
    expect(api.listarUsuarios).not.toHaveBeenCalled();
  });
});

describe('Cierre y vencimiento de la sesión (HU01)', () => {
  it('Salir cierra la sesión y vuelve al ingreso', async () => {
    conSesion('cajero');
    const usuario = userEvent.setup();
    abrir('/');
    await usuario.click(await screen.findByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(localStorage.getItem('lapampa.sesion')).toBeNull();
  });

  it('con el token vencido vuelve al ingreso y avisa', async () => {
    conSesion('mesero', -60);
    abrir('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu sesión venció');
    expect(localStorage.getItem('lapampa.sesion')).toBeNull();
  });
});

describe('Usuarios (HU01, propietario)', () => {
  it('lista las cuentas y crea una nueva', async () => {
    conSesion('propietario');
    api.listarUsuarios.mockResolvedValue([{ ...CUENTAS.propietario, activo: true }]);
    api.crearUsuario.mockResolvedValue({ id: 9, usuario: 'yesica' });
    const usuario = userEvent.setup();
    abrir('/usuarios');

    expect(await screen.findByText('Propietario de prueba')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Nueva cuenta' }));
    await usuario.type(screen.getByLabelText('Nombre'), 'Yesica');
    await usuario.type(screen.getByLabelText('Usuario para ingresar'), 'yesica');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Segura2026');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(api.crearUsuario).toHaveBeenCalledWith({
      nombre: 'Yesica',
      usuario: 'yesica',
      contrasena: 'Segura2026',
      rol: 'mesero',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta creada: yesica');
  });

  it('el propietario no ve el botón para desactivarse a sí mismo', async () => {
    conSesion('propietario');
    api.listarUsuarios.mockResolvedValue([
      { ...CUENTAS.propietario, activo: true },
      { ...CUENTAS.mesero, activo: true },
    ]);
    abrir('/usuarios');
    await screen.findByText('Mesero de prueba');
    expect(screen.getAllByRole('button', { name: 'Desactivar' })).toHaveLength(1);
  });
});
