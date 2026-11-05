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
  enviarDomicilio: vi.fn(),
}));

const CARTA = {
  categorias: [
    {
      id: 1,
      nombre: "Pa' aguaitar",
      productos: [
        { id: 10, nombre: 'Chumblún', descripcion: 'Pescado al panko', precio: 23000 },
        { id: 11, nombre: 'Azotea', descripcion: null, precio: 15000 },
      ],
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

const RESPUESTA = {
  pedidoId: 57,
  estado: 'pendiente_pago',
  metodoPago: 'transferencia',
  items: [{ nombre: 'Chumblún', cantidad: 2, nota: null, precioUnitario: 23000, total: 46000 }],
  subtotal: 46000,
  valorEnvio: 7000,
  total: 53000,
  pago: { ...CARTA.transferencia, whatsapp: '3195654739' },
};

function abrir() {
  return render(
    <MemoryRouter initialEntries={['/pedir']}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.cartaDomicilio.mockResolvedValue(CARTA);
  api.enviarDomicilio.mockResolvedValue(RESPUESTA);
});

// Arma un pedido de 2 Chumblún y pasa al paso de los datos
async function llegarADatos(usuario) {
  abrir();
  await usuario.click(await screen.findByRole('button', { name: 'Agregar Chumblún' }));
  await usuario.click(screen.getByRole('button', { name: 'Agregar uno de Chumblún' }));
  expect(screen.getByText('$53.000')).toBeInTheDocument(); // 2 x 23.000 + 7.000 de envío
  await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
  await usuario.type(screen.getByLabelText('Nombre'), 'Yesenia Caicedo');
  await usuario.type(screen.getByLabelText('Celular'), '300 123 4567');
  await usuario.type(screen.getByLabelText('Dirección'), 'Calle 70 # 3BN-45');
}

describe('Formulario web de domicilio (HU09)', () => {
  it('abre sin iniciar sesión y muestra la carta del día con el envío', async () => {
    abrir();
    expect(await screen.findByRole('region', { name: "Pa' aguaitar" })).toBeInTheDocument();
    expect(screen.getByText('Chumblún')).toBeInTheDocument();
    expect(screen.getByText(/Envío: \$7\.000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
    expect(api.quienSoy).not.toHaveBeenCalled();
  });

  it('no deja enviar el pedido sin la autorización de datos', async () => {
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    await usuario.click(screen.getByRole('button', { name: /Contra entrega/ }));

    const enviar = screen.getByRole('button', { name: /Enviar pedido/ });
    expect(enviar).toBeDisabled();
    expect(screen.getByText(/Para enviar falta: la autorización de datos/)).toBeInTheDocument();
    await usuario.click(enviar);
    expect(api.enviarDomicilio).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole('checkbox', { name: /Autorizo a La Pampa/ }));
    expect(enviar).toBeEnabled();
  });

  it('por transferencia envía el pedido y muestra el número, la cuenta y el WhatsApp', async () => {
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    await usuario.click(screen.getByRole('button', { name: /Transferencia/ }));
    await usuario.click(screen.getByRole('checkbox', { name: /Autorizo a La Pampa/ }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar pedido · $53.000' }));

    expect(api.enviarDomicilio).toHaveBeenCalledWith({
      autorizaDatos: true,
      items: [{ productoId: 10, cantidad: 2, nota: null }],
      cliente: {
        nombre: 'Yesenia Caicedo',
        telefono: '3001234567',
        direccion: 'Calle 70 # 3BN-45',
        barrio: null,
        referencia: null,
      },
      metodoPago: 'transferencia',
      observaciones: null,
    });
    expect(await screen.findByText('#57')).toBeInTheDocument();
    expect(screen.getByText('80819808345')).toBeInTheDocument();
    expect(screen.getByText(/queda pendiente de pago/)).toBeInTheDocument();
    const whatsapp = screen.getByRole('link', { name: 'Enviar comprobante por WhatsApp' });
    expect(whatsapp.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/573195654739\?text=/);
    expect(decodeURIComponent(whatsapp.getAttribute('href'))).toContain('pedido #57');
  });

  it('contra entrega confirma que ya se está preparando', async () => {
    api.enviarDomicilio.mockResolvedValue({
      ...RESPUESTA,
      estado: 'recibido',
      metodoPago: 'contra_entrega',
      pago: null,
    });
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    await usuario.click(screen.getByRole('button', { name: /Contra entrega/ }));
    await usuario.click(screen.getByRole('checkbox', { name: /Autorizo a La Pampa/ }));
    await usuario.click(screen.getByRole('button', { name: /Enviar pedido/ }));

    expect(await screen.findByText(/Ya lo estamos preparando/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /WhatsApp/ })).not.toBeInTheDocument();
  });

  it('si un producto se agotó mientras tanto, avisa y lo quita del pedido', async () => {
    api.enviarDomicilio.mockRejectedValue({
      response: { status: 409, data: { error: '"Chumblún" está agotado hoy.' } },
    });
    const usuario = userEvent.setup();
    await llegarADatos(usuario);
    api.cartaDomicilio.mockResolvedValue({
      ...CARTA,
      categorias: [{ ...CARTA.categorias[0], productos: [CARTA.categorias[0].productos[1]] }],
    });
    await usuario.click(screen.getByRole('button', { name: /Contra entrega/ }));
    await usuario.click(screen.getByRole('checkbox', { name: /Autorizo a La Pampa/ }));
    await usuario.click(screen.getByRole('button', { name: /Enviar pedido/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('"Chumblún" está agotado hoy.');
    expect(screen.queryByText('Chumblún')).not.toBeInTheDocument();
    expect(screen.getByText('Tu pedido está vacío')).toBeInTheDocument();
  });
});
