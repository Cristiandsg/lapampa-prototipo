import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import * as api from '../services/api';

vi.mock('../services/api', async (original) => ({
  ...(await original()),
  quienSoy: vi.fn(),
  obtenerPedido: vi.fn(),
  cobrarPedido: vi.fn(),
  listarPorCobrar: vi.fn(),
  obtenerCierre: vi.fn(),
}));

const CAJERO = { id: 2, nombre: 'Cajero de prueba', usuario: 'cajero', rol: 'cajero' };
const MESERO = { id: 3, nombre: 'Mesero de prueba', usuario: 'mesero', rol: 'mesero' };

const PEDIDO = {
  id: 41,
  mesa: 'Terraza 2',
  mesero: 'Ana',
  estado: 'por_cobrar',
  creado_en: '2026-10-27T23:10:00.000Z',
  subtotal: 53000,
  propina_sugerida: 5300,
  items: [
    { id: 1, nombre: 'Azotea', cantidad: 2, precio_unitario: 15000, total: 30000, nota: null },
    { id: 2, nombre: 'Chumblún', cantidad: 1, precio_unitario: 23000, total: 23000, nota: null },
  ],
  historial: [],
  pagos: [],
  propina: null,
};

function tokenFalso() {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

function abrir(ruta, quien = CAJERO) {
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
  api.obtenerPedido.mockResolvedValue(PEDIDO);
  api.listarPorCobrar.mockResolvedValue([]);
});

const boton = (nombre) => screen.getByRole('button', { name: nombre });

describe('Cobrar una cuenta (HU07 + HU08)', () => {
  it('criterio HU08: sin marcar la respuesta del cliente no se puede cobrar ni se suma propina', async () => {
    abrir('/caja/cobrar/41');
    expect(await screen.findByText('Falta preguntar')).toBeInTheDocument();
    expect(
      screen.getByText('Primero marca la respuesta del cliente sobre la propina.'),
    ).toBeInTheDocument();
    expect(boton('Registrar pago')).toBeDisabled();
    expect(screen.queryByLabelText('Efectivo')).not.toBeInTheDocument();
  });

  it('propina sugerida + todo en efectivo, con vueltas', async () => {
    api.cobrarPedido.mockResolvedValue({
      ...PEDIDO,
      estado: 'pagado',
      propina: { valor: 5300, respuesta: 'aceptada' },
    });
    const usuario = userEvent.setup();
    abrir('/caja/cobrar/41');
    await usuario.click(await screen.findByRole('button', { name: /Acepta la sugerida/ }));

    const total = within(screen.getByRole('region', { name: 'Total a cobrar' }));
    expect(total.getByText('$5.300')).toBeInTheDocument();
    expect(total.getByText('$58.300')).toBeInTheDocument();

    await usuario.click(boton('Todo en efectivo'));
    expect(screen.getByLabelText('Efectivo')).toHaveValue('58.300');
    await usuario.type(screen.getByLabelText(/Con cuánto paga/), '100000');
    expect(screen.getByText('Vueltas: $41.700')).toBeInTheDocument();
    expect(screen.getByText('Los pagos cuadran')).toBeInTheDocument();

    await usuario.click(boton('Registrar pago'));
    expect(api.cobrarPedido).toHaveBeenCalledWith(41, {
      propina: { respuesta: 'aceptada', valor: null },
      pagos: [{ medio: 'efectivo', valor: 58300, referencia: null }],
    });
    // Vuelve a la caja con el aviso
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pedido #41 cobrado: $58.300. La mesa «Terraza 2» quedó libre.',
    );
  });

  it('pago mixto con otro valor de propina: avisa cuánto falta hasta que cuadra', async () => {
    api.cobrarPedido.mockResolvedValue({ ...PEDIDO, estado: 'pagado', propina: { valor: 7000 } });
    const usuario = userEvent.setup();
    abrir('/caja/cobrar/41');
    await usuario.click(await screen.findByRole('button', { name: /Otro valor/ }));
    await usuario.type(screen.getByLabelText('¿Cuánto deja de propina?'), '7000');

    await usuario.type(screen.getByLabelText('Tarjeta'), '40000');
    expect(screen.getByText('Faltan $20.000')).toBeInTheDocument();
    expect(boton('Registrar pago')).toBeDisabled();
    await usuario.type(screen.getByLabelText('Transferencia'), '25000');
    expect(screen.getByText('Sobran $5.000')).toBeInTheDocument();
    await usuario.clear(screen.getByLabelText('Transferencia'));
    await usuario.type(screen.getByLabelText('Transferencia'), '20000');
    await usuario.type(screen.getByLabelText(/Referencia/), 'Nequi 300');
    expect(boton('Registrar pago')).toBeEnabled();

    await usuario.click(boton('Registrar pago'));
    expect(api.cobrarPedido).toHaveBeenCalledWith(41, {
      propina: { respuesta: 'modificada', valor: 7000 },
      pagos: [
        { medio: 'tarjeta', valor: 40000, referencia: null },
        { medio: 'transferencia', valor: 20000, referencia: 'Nequi 300' },
      ],
    });
  });

  it('sin propina se cobra solo el consumo', async () => {
    api.cobrarPedido.mockResolvedValue({ ...PEDIDO, estado: 'pagado', propina: { valor: 0 } });
    const usuario = userEvent.setup();
    abrir('/caja/cobrar/41');
    await usuario.click(await screen.findByRole('button', { name: /No deja propina/ }));
    await usuario.click(boton('Todo con tarjeta'));
    expect(screen.getByLabelText('Tarjeta')).toHaveValue('53.000');
    await usuario.click(boton('Registrar pago'));
    expect(api.cobrarPedido).toHaveBeenCalledWith(41, {
      propina: { respuesta: 'rechazada', valor: null },
      pagos: [{ medio: 'tarjeta', valor: 53000, referencia: null }],
    });
  });

  it('si otro cajero ya lo cobró, muestra el error de la API', async () => {
    api.cobrarPedido.mockRejectedValue({
      response: {
        status: 409,
        data: { error: 'El pedido #41 ya fue pagado: no se puede cobrar.' },
      },
    });
    const usuario = userEvent.setup();
    abrir('/caja/cobrar/41');
    await usuario.click(await screen.findByRole('button', { name: /No deja propina/ }));
    await usuario.click(boton('Todo en efectivo'));
    await usuario.click(boton('Registrar pago'));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya fue pagado');
  });

  it('un pedido que no está por cobrar no se deja cobrar', async () => {
    api.obtenerPedido.mockResolvedValue({ ...PEDIDO, estado: 'abierto' });
    abrir('/caja/cobrar/41');
    expect(await screen.findByText(/no tiene la cuenta generada/)).toBeInTheDocument();
  });

  it('el mesero no entra a cobrar', async () => {
    abrir('/caja/cobrar/41', MESERO);
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});

describe('Cierre de caja (HU07) y propinas por mesero (HU08)', () => {
  const CIERRE = {
    fecha: '2026-10-27',
    pedidosPagados: 3,
    consumo: 159000,
    propinas: {
      total: 10300,
      porMesero: [
        { mesero: 'Ana', total: 10300, pedidos: 2, aceptadas: 1, modificadas: 1, rechazadas: 0 },
        { mesero: 'Luis', total: 0, pedidos: 1, aceptadas: 0, modificadas: 0, rechazadas: 1 },
      ],
    },
    porMedio: [
      { medio: 'efectivo', total: 103000, pagos: 2 },
      { medio: 'tarjeta', total: 8300, pagos: 1 },
      { medio: 'transferencia', total: 58000, pagos: 1 },
    ],
    totalRecaudado: 169300,
    porCobrar: { cantidad: 1, total: 53000 },
  };

  it('muestra lo recaudado por medio, ventas, propinas por mesero y lo pendiente', async () => {
    api.obtenerCierre.mockResolvedValue(CIERRE);
    abrir('/caja/cierre');
    expect(await screen.findByLabelText('Día')).toHaveValue('2026-10-27');
    expect(api.obtenerCierre).toHaveBeenCalledWith(undefined);
    expect(screen.getAllByText('$169.300')).toHaveLength(2);
    expect(screen.getByText('3 pedidos pagados')).toBeInTheDocument();
    expect(screen.getByText('$103.000')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText(/2 mesas cobradas · aceptaron 1 · otro valor 1/)).toBeInTheDocument();
    expect(screen.getByText(/Quedan 1 cuenta por cobrar/)).toBeInTheDocument();
  });

  it('al cambiar el día consulta ese día', async () => {
    api.obtenerCierre.mockResolvedValue(CIERRE);
    const usuario = userEvent.setup();
    abrir('/caja/cierre');
    const dia = await screen.findByLabelText('Día');
    api.obtenerCierre.mockResolvedValue({ ...CIERRE, fecha: '2026-10-26' });
    await usuario.clear(dia);
    await usuario.type(dia, '2026-10-26');
    expect(api.obtenerCierre).toHaveBeenLastCalledWith('2026-10-26');
  });

  it('desde la caja se llega al cierre', async () => {
    api.obtenerCierre.mockResolvedValue(CIERRE);
    const usuario = userEvent.setup();
    abrir('/caja');
    await usuario.click(await screen.findByRole('link', { name: 'Cierre de caja del día' }));
    expect(await screen.findByRole('heading', { name: 'Cierre de caja' })).toBeInTheDocument();
  });
});
