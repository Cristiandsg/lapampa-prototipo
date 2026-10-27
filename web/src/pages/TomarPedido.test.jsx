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
  listarCategorias: vi.fn(),
  listarProductos: vi.fn(),
  crearPedido: vi.fn(),
  obtenerPedido: vi.fn(),
}));

const MESERO = { id: 3, nombre: 'Mesero de prueba', usuario: 'mesero', rol: 'mesero' };
const MESAS = [
  { id: 1, nombre: 'Terraza 2', estado: 'libre', pedido: null },
  { id: 2, nombre: 'Barra', estado: 'ocupada', pedido: { id: 40, total: 52000, minutos: 5 } },
];
const CATEGORIAS = [
  { id: 1, nombre: "Pa' aguaitar", orden: 1, activa: true },
  { id: 2, nombre: 'Limonadas', orden: 2, activa: true },
];
const PRODUCTOS = [
  { id: 10, categoria_id: 1, nombre: 'Chumblún', descripcion: 'Pescado al panko', precio: 23000 },
  { id: 11, categoria_id: 1, nombre: 'Azotea', descripcion: 'Patacones con ahogao', precio: 15000 },
  { id: 20, categoria_id: 2, nombre: 'Limonada de coco', descripcion: null, precio: 13000 },
];
const PEDIDO = {
  id: 41,
  mesa: 'Terraza 2',
  mesero: 'Mesero de prueba',
  estado: 'abierto',
  creado_en: '2026-10-22T02:10:00.000Z',
  subtotal: 53000,
  observaciones: null,
  items: [
    { id: 1, nombre: 'Azotea', cantidad: 2, total: 30000, nota: 'sin cebolla' },
    { id: 2, nombre: 'Chumblún', cantidad: 1, total: 23000, nota: null },
  ],
  comanda: 'LA PAMPA - COCINA\nMESA: Terraza 2\n2 x Azotea\n    * sin cebolla',
};

function tokenFalso() {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

function abrir(ruta) {
  localStorage.setItem('lapampa.sesion', JSON.stringify({ token: tokenFalso(), usuario: MESERO }));
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <App />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.quienSoy.mockResolvedValue(MESERO);
  api.listarMesas.mockResolvedValue(MESAS);
  api.listarCategorias.mockResolvedValue(CATEGORIAS);
  api.listarProductos.mockResolvedValue(PRODUCTOS);
  api.obtenerPedido.mockResolvedValue(PEDIDO);
});

describe('Tomar pedido (HU04)', () => {
  it('al tocar una mesa libre se abre su pedido con la carta disponible hoy', async () => {
    const usuario = userEvent.setup();
    abrir('/mesas');
    await usuario.click(await screen.findByText('Terraza 2', { selector: '.mesa-nombre' }));
    expect(await screen.findByRole('heading', { name: 'Terraza 2' })).toBeInTheDocument();
    expect(screen.getByText('Pedido nuevo · Mesero de prueba')).toBeInTheDocument();
    expect(api.listarProductos).toHaveBeenCalledWith({ disponibles: true });
    expect(screen.getByRole('region', { name: "Pa' aguaitar" })).toBeInTheDocument();
  });

  it('al tocar una mesa ocupada se ve su pedido', async () => {
    const usuario = userEvent.setup();
    abrir('/mesas');
    await usuario.click(await screen.findByText('Barra', { selector: '.mesa-nombre' }));
    expect(api.obtenerPedido).toHaveBeenCalledWith('40');
  });

  it('suma cantidades, agrega notas y envía el pedido a cocina', async () => {
    api.crearPedido.mockResolvedValue({ id: 41 });
    const usuario = userEvent.setup();
    abrir('/mesas/1/pedido');
    await screen.findByText('Chumblún');

    expect(screen.getByRole('button', { name: 'Enviar a cocina' })).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Agregar Azotea' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar uno de Azotea' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar Chumblún' }));
    expect(screen.getByText('3 productos')).toBeInTheDocument();
    expect(screen.getByText('$53.000')).toBeInTheDocument();

    const azotea = screen.getByText('Azotea').closest('li');
    await usuario.click(within(azotea).getByRole('button', { name: 'Nota' }));
    await usuario.type(screen.getByLabelText('Nota para Azotea'), 'sin cebolla{Enter}');
    expect(within(azotea).getByText('Nota: sin cebolla')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Observaciones del pedido (opcional)'), 'Cumpleaños');
    await usuario.click(screen.getByRole('button', { name: 'Enviar a cocina' }));

    expect(api.crearPedido).toHaveBeenCalledWith({
      mesaId: 1,
      items: [
        { productoId: 10, cantidad: 1, nota: null },
        { productoId: 11, cantidad: 2, nota: 'sin cebolla' },
      ],
      observaciones: 'Cumpleaños',
    });
    // Queda en el pedido enviado, con la comanda lista para cocina
    expect(await screen.findByRole('status')).toHaveTextContent('Pedido #41 enviado a cocina');
    expect(screen.getByLabelText('Comanda de cocina')).toHaveTextContent('MESA: Terraza 2');
    expect(screen.getByText('$53.000')).toBeInTheDocument();
  });

  it('quitar hasta cero saca el producto del pedido', async () => {
    const usuario = userEvent.setup();
    abrir('/mesas/1/pedido');
    await usuario.click(await screen.findByRole('button', { name: 'Agregar Chumblún' }));
    await usuario.click(screen.getByRole('button', { name: 'Quitar uno de Chumblún' }));
    expect(screen.getByText('Sin productos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar a cocina' })).toBeDisabled();
  });

  it('busca en la carta sin importar tildes', async () => {
    const usuario = userEvent.setup();
    abrir('/mesas/1/pedido');
    await screen.findByText('Chumblún');
    await usuario.type(screen.getByLabelText('Buscar en la carta'), 'chumblun');
    expect(screen.getByText('Chumblún')).toBeInTheDocument();
    expect(screen.queryByText('Limonada de coco')).not.toBeInTheDocument();
  });

  it('si otro mesero ya abrió la mesa, muestra el error de la API', async () => {
    api.crearPedido.mockRejectedValue({
      response: { status: 409, data: { error: 'La mesa "Terraza 2" ya tiene un pedido abierto.' } },
    });
    const usuario = userEvent.setup();
    abrir('/mesas/1/pedido');
    await usuario.click(await screen.findByRole('button', { name: 'Agregar Chumblún' }));
    await usuario.click(screen.getByRole('button', { name: 'Enviar a cocina' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ya tiene un pedido abierto');
  });

  it('si un producto se agotó mientras tanto, lo quita y avisa', async () => {
    api.crearPedido.mockRejectedValue({
      response: { status: 409, data: { error: '"Chumblún" está agotado hoy.' } },
    });
    const usuario = userEvent.setup();
    abrir('/mesas/1/pedido');
    await usuario.click(await screen.findByRole('button', { name: 'Agregar Chumblún' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar Azotea' }));
    api.listarProductos.mockResolvedValue(PRODUCTOS.filter((p) => p.id !== 10));
    await usuario.click(screen.getByRole('button', { name: 'Enviar a cocina' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('"Chumblún" está agotado hoy.');
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.queryByText('Chumblún')).not.toBeInTheDocument();
  });

  it('una mesa que ya tiene pedido no deja abrir otro', async () => {
    abrir('/mesas/2/pedido');
    expect(
      await screen.findByText('La mesa "Barra" ya tiene un pedido abierto.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el pedido' })).toHaveAttribute(
      'href',
      '/pedidos/40',
    );
  });
});
