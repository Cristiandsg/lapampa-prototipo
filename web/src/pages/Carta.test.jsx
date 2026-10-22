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
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  crearCategoria: vi.fn(),
  actualizarCategoria: vi.fn(),
  eliminarCategoria: vi.fn(),
}));

const PROPIETARIO = {
  id: 1,
  nombre: 'Propietario de prueba',
  usuario: 'propietario',
  rol: 'propietario',
};
const CATEGORIAS = [
  { id: 1, nombre: "Pa' aguaitar", orden: 1, activa: true },
  { id: 2, nombre: 'Fuertes', orden: 2, activa: true },
  { id: 3, nombre: 'Postres', orden: 3, activa: true },
];
const PRODUCTOS = [
  {
    id: 10,
    categoria_id: 1,
    nombre: 'Chumblún',
    descripcion: 'Pescado al panko',
    precio: 23000,
    activo: true,
    agotado_hoy: false,
  },
  {
    id: 11,
    categoria_id: 2,
    nombre: 'Oye vevé',
    descripcion: null,
    precio: 40000,
    activo: true,
    agotado_hoy: true,
  },
  {
    id: 12,
    categoria_id: 2,
    nombre: 'Barajo',
    descripcion: null,
    precio: 39000,
    activo: false,
    agotado_hoy: false,
  },
];

function tokenFalso() {
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 3600 })}.firma`;
}

function abrirCarta() {
  localStorage.setItem(
    'lapampa.sesion',
    JSON.stringify({ token: tokenFalso(), usuario: PROPIETARIO }),
  );
  return render(
    <MemoryRouter initialEntries={['/carta']}>
      <App />
    </MemoryRouter>,
  );
}

const linea = (nombre) => screen.getByText(nombre).closest('li');

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  api.quienSoy.mockResolvedValue(PROPIETARIO);
  api.listarCategorias.mockResolvedValue(CATEGORIAS);
  api.listarProductos.mockResolvedValue(PRODUCTOS);
});

describe('Carta (HU02)', () => {
  it('muestra los productos agrupados por categoría, con precio y estado', async () => {
    abrirCarta();
    const aguaitar = await screen.findByRole('region', { name: "Pa' aguaitar" });
    expect(within(aguaitar).getByText('Chumblún')).toBeInTheDocument();
    expect(within(aguaitar).getByText('$23.000')).toBeInTheDocument();
    expect(
      within(linea('Oye vevé')).getByText('Agotado hoy', { selector: '.chip' }),
    ).toBeInTheDocument();
    expect(within(linea('Barajo')).getByText('Desactivado')).toBeInTheDocument();
    // Una categoría sin productos no ocupa espacio en la vista general
    expect(screen.queryByRole('region', { name: 'Postres' })).not.toBeInTheDocument();
  });

  it('filtra por categoría', async () => {
    const usuario = userEvent.setup();
    abrirCarta();
    await screen.findByText('Chumblún');
    await usuario.selectOptions(screen.getByLabelText('Ver categoría'), '2');
    expect(screen.queryByText('Chumblún')).not.toBeInTheDocument();
    expect(screen.getByText('Oye vevé')).toBeInTheDocument();
  });

  it('crea un producto con el precio como número', async () => {
    api.crearProducto.mockResolvedValue({ id: 20 });
    const usuario = userEvent.setup();
    abrirCarta();
    await screen.findByText('Chumblún');

    await usuario.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    await usuario.selectOptions(screen.getByLabelText('Categoría'), '3');
    await usuario.type(screen.getByLabelText('Nombre'), 'Cocada');
    await usuario.type(screen.getByLabelText('Precio'), '8.000');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(api.crearProducto).toHaveBeenCalledWith({
      categoriaId: 3,
      nombre: 'Cocada',
      descripcion: null,
      precio: 8000,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cocada quedó en la carta.');
  });

  it('no deja guardar un precio en cero', async () => {
    const usuario = userEvent.setup();
    abrirCarta();
    await screen.findByText('Chumblún');
    await usuario.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    await usuario.selectOptions(screen.getByLabelText('Categoría'), '1');
    await usuario.type(screen.getByLabelText('Nombre'), 'Gratis');
    await usuario.type(screen.getByLabelText('Precio'), '0');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('mayor a cero');
    expect(api.crearProducto).not.toHaveBeenCalled();
  });

  it('edita el precio y avisa que los pedidos anteriores no cambian', async () => {
    api.actualizarProducto.mockResolvedValue({});
    const usuario = userEvent.setup();
    abrirCarta();
    await usuario.click(await screen.findByRole('button', { name: 'Editar Chumblún' }));
    const precio = screen.getByLabelText('Precio');
    expect(precio).toHaveValue('23000');
    await usuario.clear(precio);
    await usuario.type(precio, '25000');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(api.actualizarProducto).toHaveBeenCalledWith(10, {
      categoriaId: 1,
      nombre: 'Chumblún',
      descripcion: 'Pescado al panko',
      precio: 25000,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('conservan su precio');
  });

  it('marca y desmarca "agotado hoy"', async () => {
    api.actualizarProducto.mockResolvedValue({});
    const usuario = userEvent.setup();
    abrirCarta();
    const boton = await screen.findByRole('button', { name: 'Agotado hoy: Chumblún' });
    expect(boton).toHaveAttribute('aria-pressed', 'false');
    await usuario.click(boton);
    expect(api.actualizarProducto).toHaveBeenCalledWith(10, { agotadoHoy: true });

    await usuario.click(screen.getByRole('button', { name: 'Agotado hoy: Oye vevé' }));
    expect(api.actualizarProducto).toHaveBeenCalledWith(11, { agotadoHoy: false });
  });

  it('desactiva en lugar de borrar, y permite activar otra vez', async () => {
    api.actualizarProducto.mockResolvedValue({});
    const usuario = userEvent.setup();
    abrirCarta();
    await usuario.click(await screen.findByRole('button', { name: 'Desactivar Chumblún' }));
    expect(api.actualizarProducto).toHaveBeenCalledWith(10, { activo: false });
    await usuario.click(screen.getByRole('button', { name: 'Activar Barajo' }));
    expect(api.actualizarProducto).toHaveBeenCalledWith(12, { activo: true });
    expect(screen.queryByRole('button', { name: /Eliminar Chumblún/ })).not.toBeInTheDocument();
  });

  it('muestra el error de la API (nombre repetido)', async () => {
    api.crearProducto.mockRejectedValue({
      response: { data: { error: 'Ya existe un producto con ese nombre.' } },
    });
    const usuario = userEvent.setup();
    abrirCarta();
    await screen.findByText('Chumblún');
    await usuario.click(screen.getByRole('button', { name: 'Nuevo producto' }));
    await usuario.selectOptions(screen.getByLabelText('Categoría'), '1');
    await usuario.type(screen.getByLabelText('Nombre'), 'Chumblún');
    await usuario.type(screen.getByLabelText('Precio'), '1000');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya existe un producto con ese nombre.',
    );
  });

  it('solo deja eliminar categorías vacías', async () => {
    const usuario = userEvent.setup();
    abrirCarta();
    await screen.findByText('Chumblún');
    await usuario.click(screen.getByText('Categorías de la carta'));
    const lista = screen.getByText('Categorías de la carta').closest('details');
    const postres = within(lista).getByText('Postres').closest('li');
    const fuertes = within(lista).getByText('Fuertes').closest('li');
    expect(within(postres).getByRole('button', { name: 'Eliminar' })).toBeInTheDocument();
    expect(within(fuertes).queryByRole('button', { name: 'Eliminar' })).not.toBeInTheDocument();
  });

  it('un mesero no puede entrar a la carta', async () => {
    localStorage.setItem(
      'lapampa.sesion',
      JSON.stringify({ token: tokenFalso(), usuario: { ...PROPIETARIO, rol: 'mesero' } }),
    );
    api.quienSoy.mockResolvedValue({ ...PROPIETARIO, rol: 'mesero' });
    render(
      <MemoryRouter initialEntries={['/carta']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Esta opción no es para tu rol')).toBeInTheDocument();
    expect(api.listarProductos).not.toHaveBeenCalled();
  });
});
