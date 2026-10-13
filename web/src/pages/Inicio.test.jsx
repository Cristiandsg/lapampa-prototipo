import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import Inicio from './Inicio';

vi.mock('../services/api', () => ({
  obtenerSalud: vi.fn().mockResolvedValue({ estado: 'ok', baseDeDatos: 'conectada' }),
}));

describe('Inicio', () => {
  it('muestra el estado de la API y de la base de datos', async () => {
    render(<Inicio />);
    expect(await screen.findByText(/API funcionando/i)).toBeInTheDocument();
    expect(screen.getByText(/Base de datos conectada/i)).toBeInTheDocument();
  });
});
