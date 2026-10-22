import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import * as api from '../services/api';

vi.mock('../services/api', async (original) => ({
  ...(await original()),
  quienSoy: vi.fn(),
  listarMesas: vi.fn(),
  crearMesa: vi.fn(),
  renombrarMesa: vi.fn(),
  eliminarMesa: vi.fn(),
  quitarMesasLibres: vi.fn(),
}));

const MESERO = { id: 3, nombre: 'Mesero de prueba', usuario: 'mesero', rol: 'mesero' };
const MESAS = [
  { id: 1, nombre: 'Terraza 2', estado: 'ocupada', pedido: { id: 7, total: 86000, minutos: 35 } },
  { id: 2, nombre: 'Barra', estado: 'por_cobrar', pedido: { id: 8, total: 52000, minutos: 70 } },
  { id: 3, nombre: 'Terraza 1', estado: 'libre', pedido: null },
  {
    id: 4,
    nombre: 'Cumpleaños Andrea',
    estado: 'ocupada',
    pedido: { id: 9, total: 214000, minutos: 70 },
  },
];

function tokenFalso() {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

function abrir(usuario = MESERO, ruta = '/mesas') {
  localStorage.setItem('lapampa.sesion', JSON.stringify({ token: tokenFalso(), usuario }));
  api.quienSoy.mockResolvedValue(usuario);
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

const tarjeta = (nombre) =>
  screen.getByText(nombre, { selector: '.mesa-nombre' }).closest('button');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.listarMesas.mockResolvedValue(MESAS);
});

describe('Mesas de hoy (HU03)', () => {
  it('muestra una tarjeta por mesa con su estado, total y tiempo', async () => {
    abrir();
    expect(await screen.findByRole('heading', { name: 'Mesas de hoy' })).toBeInTheDocument();
    expect(within(tarjeta('Terraza 2')).getByText('Ocupada')).toBeInTheDocument();
    expect(within(tarjeta('Terraza 2')).getByText('$86.000 · 35 min')).toBeInTheDocument();
    expect(within(tarjeta('Barra')).getByText('Por cobrar')).toBeInTheDocument();
    expect(within(tarjeta('Barra')).getByText('$52.000 · en caja')).toBeInTheDocument();
    expect(
      within(tarjeta('Cumpleaños Andrea')).getByText('$214.000 · 1 h 10 min'),
    ).toBeInTheDocument();
    expect(within(tarjeta('Terraza 1')).getByText('Libre')).toBeInTheDocument();
  });

  it('filtra por estado y muestra cuántas hay de cada una', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    expect(screen.getByRole('button', { name: 'Ocupadas (2)' })).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Libres (1)' }));
    expect(
      within(screen.getByRole('list', { name: 'Mesas' })).getAllByRole('listitem'),
    ).toHaveLength(1);
    expect(screen.queryByText('Barra')).not.toBeInTheDocument();
  });

  it('crea una mesa con el nombre que el mesero escribe', async () => {
    api.crearMesa.mockResolvedValue({ id: 9, nombre: 'Patio' });
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(screen.getByRole('button', { name: /Nueva mesa/ }));
    await usuario.type(screen.getByLabelText('Nombre de la mesa'), 'Patio');
    await usuario.click(screen.getByRole('button', { name: 'Crear mesa' }));
    expect(api.crearMesa).toHaveBeenCalledWith('Patio');
    expect(await screen.findByRole('status')).toHaveTextContent('Mesa "Patio" creada.');
    expect(api.listarMesas).toHaveBeenCalledTimes(2);
  });

  it('no envía un nombre vacío', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(screen.getByRole('button', { name: /Nueva mesa/ }));
    await usuario.type(screen.getByLabelText('Nombre de la mesa'), '   ');
    await usuario.click(screen.getByRole('button', { name: 'Crear mesa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Escribe el nombre de la mesa.');
    expect(api.crearMesa).not.toHaveBeenCalled();
  });

  it('muestra el error si el nombre ya existe', async () => {
    api.crearMesa.mockRejectedValue({
      response: { data: { error: 'Ya hay una mesa activa llamada "Barra". Usa otro nombre.' } },
    });
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(screen.getByRole('button', { name: /Nueva mesa/ }));
    await usuario.type(screen.getByLabelText('Nombre de la mesa'), 'Barra');
    await usuario.click(screen.getByRole('button', { name: 'Crear mesa' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya hay una mesa activa llamada "Barra"',
    );
  });

  it('renombra una mesa libre desde sus opciones', async () => {
    api.renombrarMesa.mockResolvedValue({});
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(tarjeta('Terraza 1'));
    const hoja = screen.getByRole('dialog', { name: 'Terraza 1' });
    const campo = within(hoja).getByLabelText('Cambiar nombre');
    await usuario.clear(campo);
    await usuario.type(campo, 'Ventana');
    await usuario.click(within(hoja).getByRole('button', { name: 'Guardar' }));
    expect(api.renombrarMesa).toHaveBeenCalledWith(3, 'Ventana');
    expect(await screen.findByRole('status')).toHaveTextContent(
      '"Terraza 1" ahora se llama "Ventana".',
    );
  });

  it('eliminar pide confirmación antes de hacerlo', async () => {
    api.eliminarMesa.mockResolvedValue();
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(tarjeta('Terraza 1'));
    await usuario.click(screen.getByRole('button', { name: 'Eliminar mesa' }));
    expect(api.eliminarMesa).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole('button', { name: 'Sí, eliminar «Terraza 1»' }));
    expect(api.eliminarMesa).toHaveBeenCalledWith(3);
  });

  it('una mesa con pedido abierto no ofrece renombrar ni eliminar', async () => {
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(tarjeta('Terraza 2'));
    const hoja = screen.getByRole('dialog', { name: 'Terraza 2' });
    expect(within(hoja).getByText(/Tiene un pedido abierto/)).toBeInTheDocument();
    expect(within(hoja).queryByRole('button', { name: 'Eliminar mesa' })).not.toBeInTheDocument();
    expect(within(hoja).queryByLabelText('Cambiar nombre')).not.toBeInTheDocument();
    await usuario.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('al cerrar la jornada quita las mesas libres', async () => {
    api.quitarMesasLibres.mockResolvedValue(1);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const usuario = userEvent.setup();
    abrir();
    await screen.findByText('Terraza 1');
    await usuario.click(
      screen.getByRole('button', { name: 'Cerrar jornada: quitar mesas libres' }),
    );
    expect(api.quitarMesasLibres).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Se quitó 1 mesa libre.');
  });

  it('sin mesas invita a crear la primera', async () => {
    api.listarMesas.mockResolvedValue([]);
    abrir();
    expect(await screen.findByText('Todavía no hay mesas')).toBeInTheDocument();
  });

  it('el propietario también entra, y con botón para volver al menú', async () => {
    abrir({ id: 1, nombre: 'Propietario de prueba', usuario: 'propietario', rol: 'propietario' });
    await screen.findByText('Terraza 1');
    expect(screen.getByRole('link', { name: 'Volver al menú' })).toBeInTheDocument();
  });

  it('el cajero no entra a las mesas', async () => {
    abrir({ id: 2, nombre: 'Cajero de prueba', usuario: 'cajero', rol: 'cajero' });
    expect(await screen.findByText('Esta opción no es para tu rol')).toBeInTheDocument();
  });
});
