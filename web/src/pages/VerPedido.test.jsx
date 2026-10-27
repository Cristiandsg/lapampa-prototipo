import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import * as api from '../services/api';

vi.mock('../services/api', async (original) => ({
  ...(await original()),
  quienSoy: vi.fn(),
  listarCategorias: vi.fn(),
  listarProductos: vi.fn(),
  obtenerPedido: vi.fn(),
  agregarAlPedido: vi.fn(),
  cambiarLineaPedido: vi.fn(),
  quitarDelPedido: vi.fn(),
  cerrarPedido: vi.fn(),
  reabrirPedido: vi.fn(),
  listarPorCobrar: vi.fn(),
}));

const MESERO = { id: 3, nombre: 'Mesero de prueba', usuario: 'mesero', rol: 'mesero' };
const CAJERO = { id: 2, nombre: 'Cajero de prueba', usuario: 'cajero', rol: 'cajero' };

const azotea = {
  id: 1,
  nombre: 'Azotea',
  cantidad: 2,
  precio_unitario: 15000,
  total: 30000,
  nota: 'sin cebolla',
};
const chumblun = {
  id: 2,
  nombre: 'Chumblún',
  cantidad: 1,
  precio_unitario: 23000,
  total: 23000,
  nota: null,
};
const PEDIDO = {
  id: 41,
  mesa: 'Terraza 2',
  mesero: 'Mesero de prueba',
  estado: 'abierto',
  creado_en: '2026-10-22T02:10:00.000Z',
  subtotal: 53000,
  observaciones: null,
  items: [azotea, chumblun],
  historial: [
    {
      id: 1,
      accion: 'crear',
      usuario: 'Mesero de prueba',
      creado_en: '2026-10-22T02:10:00.000Z',
    },
  ],
  comanda: 'LA PAMPA - COCINA\nMESA: Terraza 2',
  cuenta: 'LA PAMPA GASTROBAR\nCUENTA\nTOTAL $53.000\nPropina sugerida (10 %) $5.300',
};

function tokenFalso() {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

function abrir(ruta, quien = MESERO) {
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
});

async function abrirHoja(usuario, nombre) {
  abrir('/pedidos/41');
  await usuario.click(await screen.findByRole('button', { name: `Cambiar ${nombre}` }));
  return screen.getByRole('dialog', { name: nombre });
}

describe('Modificar un pedido abierto (HU05)', () => {
  it('bajar la cantidad pide el motivo y el total se recalcula al instante', async () => {
    api.cambiarLineaPedido.mockResolvedValue({
      ...PEDIDO,
      subtotal: 38000,
      items: [{ ...azotea, cantidad: 1, total: 15000 }, chumblun],
      ajuste: '*** ANULAR ***\n- 1 x Azotea',
    });
    const usuario = userEvent.setup();
    const hoja = await abrirHoja(usuario, 'Azotea');

    const guardar = within(hoja).getByRole('button', { name: 'Guardar cambio' });
    expect(guardar).toBeDisabled();
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar uno' }));
    expect(within(hoja).getByText('$38.000')).toBeInTheDocument();
    expect(within(hoja).getByRole('textbox', { name: /Motivo/ })).toBeInTheDocument();
    expect(guardar).toBeDisabled();

    await usuario.click(within(hoja).getByRole('button', { name: 'Se demoró mucho' }));
    expect(guardar).toBeEnabled();
    await usuario.click(guardar);

    expect(api.cambiarLineaPedido).toHaveBeenCalledWith(41, 1, {
      cantidad: 1,
      nota: 'sin cebolla',
      motivo: 'Se demoró mucho',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cambio enviado a cocina.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ajuste enviado a cocina')).toHaveTextContent('- 1 x Azotea');
    expect(screen.getByText('$38.000')).toBeInTheDocument();
  });

  it('cambiar solo la nota no pide motivo', async () => {
    api.cambiarLineaPedido.mockResolvedValue({ ...PEDIDO, ajuste: '*** CAMBIO ***' });
    const usuario = userEvent.setup();
    const hoja = await abrirHoja(usuario, 'Chumblún');
    await usuario.type(within(hoja).getByLabelText('Nota para cocina'), 'bien dorado');
    expect(within(hoja).queryByRole('textbox', { name: /Motivo/ })).not.toBeInTheDocument();
    await usuario.click(within(hoja).getByRole('button', { name: 'Guardar cambio' }));
    expect(api.cambiarLineaPedido).toHaveBeenCalledWith(41, 2, {
      cantidad: 1,
      nota: 'bien dorado',
    });
  });

  it('bajar a cero quita el producto con su motivo', async () => {
    api.quitarDelPedido.mockResolvedValue({
      ...PEDIDO,
      subtotal: 30000,
      items: [azotea],
      ajuste: '*** ANULAR ***',
    });
    const usuario = userEvent.setup();
    const hoja = await abrirHoja(usuario, 'Chumblún');
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar uno' }));
    await usuario.type(within(hoja).getByRole('textbox', { name: /Motivo/ }), 'No quiso');
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar del pedido' }));
    expect(api.quitarDelPedido).toHaveBeenCalledWith(41, 2, 'No quiso');
    expect(await screen.findByRole('status')).toHaveTextContent('Cambio enviado a cocina.');
  });

  it('quitar el único producto avisa que se anula el pedido y libera la mesa', async () => {
    api.obtenerPedido.mockResolvedValue({ ...PEDIDO, subtotal: 23000, items: [chumblun] });
    api.quitarDelPedido.mockResolvedValue({
      ...PEDIDO,
      estado: 'cancelado',
      subtotal: 0,
      items: [],
      ajuste: '*** PEDIDO ANULADO ***',
    });
    const usuario = userEvent.setup();
    const hoja = await abrirHoja(usuario, 'Chumblún');
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar uno' }));
    expect(
      within(hoja).getByText(/el pedido #41 se anula y la mesa «Terraza 2» queda libre/),
    ).toBeInTheDocument();
    await usuario.click(within(hoja).getByRole('button', { name: 'El cliente cambió de opinión' }));
    await usuario.click(within(hoja).getByRole('button', { name: 'Sí, anular el pedido' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Pedido anulado. La mesa «Terraza 2» quedó libre.',
    );
    expect(screen.getByText('Anulado')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Agregar productos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cambiar/ })).not.toBeInTheDocument();
  });

  it('si otro celular cambió el pedido antes, avisa y recarga', async () => {
    api.quitarDelPedido.mockRejectedValue({
      response: { status: 404, data: { error: 'Ese producto ya no está en el pedido.' } },
    });
    const usuario = userEvent.setup();
    const hoja = await abrirHoja(usuario, 'Chumblún');
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar uno' }));
    await usuario.type(within(hoja).getByRole('textbox', { name: /Motivo/ }), 'Repetido');
    api.obtenerPedido.mockResolvedValue({ ...PEDIDO, subtotal: 30000, items: [azotea] });
    await usuario.click(within(hoja).getByRole('button', { name: 'Quitar del pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ese producto ya no está en el pedido. Se actualizó el pedido con lo último.',
    );
    expect(
      await screen.findByText('$30.000', { selector: '.total-pedido span' }),
    ).toBeInTheDocument();
  });

  it('muestra el historial con quién, qué y el motivo', async () => {
    api.obtenerPedido.mockResolvedValue({
      ...PEDIDO,
      historial: [
        ...PEDIDO.historial,
        {
          id: 2,
          accion: 'quitar_item',
          valor_anterior: '1 x Batea',
          motivo: 'Se demoró mucho',
          usuario: 'Ana',
          creado_en: '2026-10-22T02:30:00.000Z',
        },
      ],
    });
    abrir('/pedidos/41');
    expect(await screen.findByText('Cambios del pedido (2)')).toBeInTheDocument();
    expect(screen.getByText('Quitó 1 x Batea')).toBeInTheDocument();
    expect(screen.getByText('Motivo: Se demoró mucho')).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
  });

  it('el cajero ve el pedido pero no lo modifica', async () => {
    abrir('/pedidos/41', CAJERO);
    expect(await screen.findByText('2 × Azotea')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cambiar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Agregar productos/ })).not.toBeInTheDocument();
  });
});

describe('Agregar productos al pedido (HU05)', () => {
  beforeEach(() => {
    api.listarCategorias.mockResolvedValue([
      { id: 1, nombre: "Pa' aguaitar", orden: 1, activa: true },
    ]);
    api.listarProductos.mockResolvedValue([
      { id: 10, categoria_id: 1, nombre: 'Chumblún', descripcion: null, precio: 23000 },
      { id: 11, categoria_id: 1, nombre: 'Azotea', descripcion: null, precio: 15000 },
    ]);
  });

  it('desde el pedido abre la carta y envía solo la adición', async () => {
    api.agregarAlPedido.mockResolvedValue({
      ...PEDIDO,
      ajuste: '*** ADICIÓN ***\n+ 2 x Azotea',
    });
    const usuario = userEvent.setup();
    abrir('/pedidos/41');
    await usuario.click(await screen.findByRole('link', { name: /Agregar productos/ }));

    expect(await screen.findByText('Adición al pedido #41 · Mesero de prueba')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Observaciones/)).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Agregar Azotea' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar uno de Azotea' }));
    expect(screen.getByText('Pedido completo: $83.000')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Enviar adición' }));

    expect(api.agregarAlPedido).toHaveBeenCalledWith(41, [
      { productoId: 11, cantidad: 2, nota: null },
    ]);
    expect(await screen.findByRole('status')).toHaveTextContent('Adición enviada a cocina.');
    expect(screen.getByLabelText('Ajuste enviado a cocina')).toHaveTextContent('+ 2 x Azotea');
  });

  it('un pedido que ya no está abierto no deja agregar', async () => {
    api.obtenerPedido.mockResolvedValue({ ...PEDIDO, estado: 'por_cobrar' });
    abrir('/pedidos/41/agregar');
    expect(
      await screen.findByText(
        'El pedido #41 ya no está abierto: no se le pueden agregar productos.',
      ),
    ).toBeInTheDocument();
  });
});

describe('Generar la cuenta (HU06)', () => {
  const CERRADO = {
    ...PEDIDO,
    estado: 'por_cobrar',
    cerrado_en: '2026-10-22T03:00:00.000Z',
  };

  it('muestra la vista previa y, al confirmar, la mesa pasa a por cobrar', async () => {
    api.cerrarPedido.mockResolvedValue(CERRADO);
    const usuario = userEvent.setup();
    abrir('/pedidos/41');
    await usuario.click(await screen.findByRole('button', { name: 'Generar la cuenta' }));

    const hoja = screen.getByRole('dialog', { name: 'Cuenta de Terraza 2' });
    expect(within(hoja).getByLabelText('Vista previa de la cuenta')).toHaveTextContent(
      'Propina sugerida (10 %) $5.300',
    );
    await usuario.click(within(hoja).getByRole('button', { name: 'Sí, generar la cuenta' }));

    expect(api.cerrarPedido).toHaveBeenCalledWith(41);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Cuenta generada. La mesa «Terraza 2» pasó a «por cobrar» y ya está en la caja.',
    );
    expect(screen.getByText('Por cobrar', { selector: '.chip' })).toBeInTheDocument();
    expect(screen.getByLabelText('Cuenta')).toHaveTextContent('TOTAL $53.000');
    // Ya no se puede modificar
    expect(screen.queryByRole('button', { name: /Cambiar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Agregar productos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generar la cuenta' })).not.toBeInTheDocument();
  });

  it('cancelar la vista previa no cierra el pedido', async () => {
    const usuario = userEvent.setup();
    abrir('/pedidos/41');
    await usuario.click(await screen.findByRole('button', { name: 'Generar la cuenta' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.cerrarPedido).not.toHaveBeenCalled();
  });

  it('si otro celular ya generó la cuenta, avisa y recarga', async () => {
    api.cerrarPedido.mockRejectedValue({
      response: {
        status: 409,
        data: {
          error:
            'El pedido #41 ya tiene la cuenta generada: no se puede generar la cuenta otra vez.',
        },
      },
    });
    const usuario = userEvent.setup();
    abrir('/pedidos/41');
    await usuario.click(await screen.findByRole('button', { name: 'Generar la cuenta' }));
    api.obtenerPedido.mockResolvedValue(CERRADO);
    await usuario.click(screen.getByRole('button', { name: 'Sí, generar la cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene la cuenta generada');
    expect(await screen.findByLabelText('Cuenta')).toBeInTheDocument();
  });

  it('reabrir pide el motivo y deja el pedido abierto otra vez', async () => {
    api.obtenerPedido.mockResolvedValue(CERRADO);
    api.reabrirPedido.mockResolvedValue(PEDIDO);
    const usuario = userEvent.setup();
    abrir('/pedidos/41');
    await usuario.click(await screen.findByRole('button', { name: 'Reabrir pedido' }));
    const hoja = screen.getByRole('dialog', { name: 'Reabrir pedido' });
    const boton = within(hoja).getByRole('button', { name: 'Reabrir pedido' });
    expect(boton).toBeDisabled();
    await usuario.click(within(hoja).getByRole('button', { name: 'El cliente pidió algo más' }));
    await usuario.click(boton);
    expect(api.reabrirPedido).toHaveBeenCalledWith(41, 'El cliente pidió algo más');
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido reabierto.');
    expect(screen.getByRole('button', { name: 'Generar la cuenta' })).toBeInTheDocument();
  });

  it('el cajero también genera la cuenta y vuelve a la caja', async () => {
    abrir('/pedidos/41', CAJERO);
    expect(await screen.findByRole('button', { name: 'Generar la cuenta' })).toBeInTheDocument();
    for (const enlace of screen.getAllByRole('link', { name: 'Volver a caja' })) {
      expect(enlace).toHaveAttribute('href', '/caja');
    }
  });
});

describe('Caja: cuentas por cobrar (HU06)', () => {
  it('lista las cuentas con mesa, total, mesero y abre cada una', async () => {
    api.listarPorCobrar.mockResolvedValue([
      { id: 41, mesa: 'Terraza 2', mesero: 'Ana', subtotal: 53000, productos: 3, minutos: 4 },
      { id: 44, mesa: 'Barra', mesero: 'Luis', subtotal: 24000, productos: 1, minutos: 0 },
    ]);
    abrir('/caja', CAJERO);
    const terraza = await screen.findByRole('link', { name: /Terraza 2/ });
    expect(terraza).toHaveAttribute('href', '/pedidos/41');
    expect(within(terraza).getByText('$53.000')).toBeInTheDocument();
    expect(within(terraza).getByText(/Pedido #41 · 3 productos · Ana/)).toBeInTheDocument();
    expect(within(terraza).getByText('Cuenta hace 4 min')).toBeInTheDocument();
    expect(screen.getByText('Total por cobrar')).toBeInTheDocument();
    expect(screen.getByText('$77.000')).toBeInTheDocument();
  });

  it('sin cuentas lo dice', async () => {
    api.listarPorCobrar.mockResolvedValue([]);
    abrir('/caja', CAJERO);
    expect(await screen.findByText('No hay cuentas por cobrar.')).toBeInTheDocument();
  });

  it('el mesero no entra a la caja', async () => {
    api.listarPorCobrar.mockResolvedValue([]);
    abrir('/caja');
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
    expect(api.listarPorCobrar).not.toHaveBeenCalled();
  });
});
