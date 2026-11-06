import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import * as api from '../services/api';

vi.mock('../services/api', async (original) => ({
  ...(await original()),
  quienSoy: vi.fn(),
  cartaDomicilio: vi.fn(),
  registrarDomicilio: vi.fn(),
  enviarDomicilio: vi.fn(),
  buscarClientePorTelefono: vi.fn(),
}));

const CARTA = {
  categorias: [
    {
      id: 1,
      nombre: "Pa' aguaitar",
      productos: [{ id: 10, nombre: 'Chumblún', descripcion: null, precio: 23000 }],
    },
  ],
  valorEnvio: 7000,
  whatsapp: '3195654739',
  transferencia: {
    banco: 'Bancolombia',
    tipo: 'Cuenta de ahorros',
    numero: '80819808345',
    titular: null,
  },
};

const CAJERO = { id: 2, nombre: 'Cajero', usuario: 'cajero', rol: 'cajero' };

// Token con forma de JWT y vigente, como el que guarda la sesión
const tokenFalso = () =>
  `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.x`;

function abrir(ruta = '/domicilios/nuevo', quien = CAJERO) {
  localStorage.setItem('lapampa.sesion', JSON.stringify({ token: tokenFalso(), usuario: quien }));
  api.quienSoy.mockResolvedValue(quien);
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.quienSoy.mockResolvedValue(CAJERO);
  api.cartaDomicilio.mockResolvedValue(CARTA);
  api.registrarDomicilio.mockResolvedValue({
    pedidoId: 80,
    estado: 'pendiente_pago',
    metodoPago: 'transferencia',
    items: [{ nombre: 'Chumblún', cantidad: 1, nota: null, precioUnitario: 23000, total: 23000 }],
    subtotal: 23000,
    valorEnvio: 7000,
    total: 30000,
    pago: { ...CARTA.transferencia, whatsapp: '3195654739' },
  });
});

async function llegarADatos(usuario) {
  abrir();
  await usuario.click(await screen.findByRole('button', { name: 'Agregar Chumblún' }));
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('Registrar domicilio por llamada o WhatsApp (HU10)', () => {
  it('el cajero entra desde el menú', async () => {
    abrir('/');
    const enlace = await screen.findByRole('link', { name: /Registrar domicilio/ });
    expect(enlace).toHaveAttribute('href', '/domicilios/nuevo');
  });

  it('un mesero no puede entrar', async () => {
    abrir('/domicilios/nuevo', { ...CAJERO, rol: 'mesero' });
    expect(await screen.findByText('Esta opción no es para tu rol')).toBeInTheDocument();
    expect(api.cartaDomicilio).not.toHaveBeenCalled();
  });

  it('al escribir el celular de un cliente registrado carga sus datos', async () => {
    api.buscarClientePorTelefono.mockResolvedValue({
      id: 4,
      nombre: 'Don Aurelio Mosquera',
      telefono: '3157778899',
      direccion: 'Carrera 1 # 72-10',
      barrio: 'Floralia',
      referencia: null,
      autorizacionFecha: '2026-11-01T15:00:00.000Z',
      autorizacionMedio: 'formulario_web',
    });
    const usuario = userEvent.setup();
    await llegarADatos(usuario);

    // El celular va primero
    const campos = screen.getAllByRole('textbox').map((c) => c.id);
    expect(campos.indexOf('telefono')).toBeLessThan(campos.indexOf('nombre'));

    await usuario.type(screen.getByLabelText('Celular', { exact: true }), '315 777 8899');
    expect(api.buscarClientePorTelefono).toHaveBeenCalledWith('3157778899');
    expect(
      await screen.findByText(/Cliente registrado: se cargaron sus datos/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre', { exact: true })).toHaveValue('Don Aurelio Mosquera');
    expect(screen.getByLabelText('Dirección', { exact: true })).toHaveValue('Carrera 1 # 72-10');
    expect(screen.getByLabelText('Barrio (opcional)')).toHaveValue('Floralia');
  });

  it('un cliente nuevo lo avisa y deja escribir sus datos', async () => {
    api.buscarClientePorTelefono.mockRejectedValue({ response: { status: 404, data: {} } });
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    await usuario.type(screen.getByLabelText('Celular', { exact: true }), '3009998877');
    expect(await screen.findByText('Cliente nuevo: escribe sus datos.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre', { exact: true })).toHaveValue('');
  });

  it('sin marcar que el cliente autorizó no se registra; con la casilla, sí, y muestra la cuenta', async () => {
    api.buscarClientePorTelefono.mockRejectedValue({ response: { status: 404, data: {} } });
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    await usuario.type(screen.getByLabelText('Celular', { exact: true }), '3009998877');
    await usuario.type(screen.getByLabelText('Nombre', { exact: true }), 'Yesenia Caicedo');
    await usuario.type(screen.getByLabelText('Dirección', { exact: true }), 'Calle 70 # 3BN-45');
    await usuario.click(screen.getByRole('button', { name: /Transferencia/ }));

    const registrar = screen.getByRole('button', { name: /Registrar domicilio ·/ });
    expect(registrar).toBeDisabled();
    await usuario.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    await usuario.click(registrar);

    expect(api.registrarDomicilio).toHaveBeenCalledWith(
      expect.objectContaining({
        autorizaDatos: true,
        metodoPago: 'transferencia',
        cliente: expect.objectContaining({ telefono: '3009998877' }),
      }),
    );
    expect(api.enviarDomicilio).not.toHaveBeenCalled();
    expect(await screen.findByText('#80')).toBeInTheDocument();
    expect(screen.getByText('Cuenta para dictarle al cliente')).toBeInTheDocument();
    expect(screen.getByText('80819808345')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();

    // Registrar otro deja el formulario en blanco
    await usuario.click(screen.getByRole('button', { name: 'Registrar otro domicilio' }));
    expect(screen.getByText('Tu pedido está vacío')).toBeInTheDocument();
  });
});
