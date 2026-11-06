import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AvisoImpresion, { avisoDe } from './AvisoImpresion';
import Reimprimir from './Reimprimir';
import * as api from '../services/api';

vi.mock('../services/api', async (original) => ({
  ...(await original()),
  estadoImpresion: vi.fn(),
  reimprimir: vi.fn(),
}));

const BIEN = {
  pendientes: 0,
  conError: 0,
  segundosEsperando: 0,
  ultimoError: null,
  agenteConectado: true,
};

beforeEach(() => vi.clearAllMocks());

describe('Aviso de impresión (HU16)', () => {
  it('no dice nada si todo imprime bien o si la tirilla apenas acaba de entrar', () => {
    expect(avisoDe('cocina', BIEN)).toBeNull();
    expect(avisoDe('cocina', { ...BIEN, pendientes: 2, segundosEsperando: 4 })).toBeNull();
  });

  it('avisa cuando la impresora falla, con el motivo', () => {
    expect(avisoDe('cocina', { ...BIEN, conError: 1, ultimoError: 'Sin papel' })).toBe(
      'La impresora de cocina no está imprimiendo: Sin papel. Hay 1 tirilla esperando; salen solas cuando se arregle.',
    );
  });

  it('avisa cuando el agente del PC de la caja no está conectado', () => {
    const aviso = avisoDe('caja', {
      ...BIEN,
      pendientes: 3,
      segundosEsperando: 90,
      agenteConectado: false,
    });
    expect(aviso).toMatch(/caja no está conectada al sistema: hay 3 tirillas esperando/);
  });

  it('se muestra en pantalla solo para la impresora con problemas', async () => {
    api.estadoImpresion.mockResolvedValue({
      cocina: { ...BIEN, conError: 2, ultimoError: 'La impresora no responde' },
      caja: BIEN,
    });
    render(<AvisoImpresion />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La impresora de cocina no está imprimiendo: La impresora no responde. Hay 2 tirillas esperando',
    );
    expect(screen.queryByText(/impresora de caja/)).not.toBeInTheDocument();
  });

  it('si no puede consultar el estado, no estorba', async () => {
    api.estadoImpresion.mockRejectedValue(new Error('sin conexión'));
    const { container } = render(<AvisoImpresion />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Reimprimir (HU16)', () => {
  it('manda la tirilla a la cola y confirma a qué impresora fue', async () => {
    api.reimprimir.mockResolvedValue({ id: 9, tipo: 'comanda', impresora: 'cocina' });
    render(<Reimprimir pedidoId={4} tipo="comanda" etiqueta="Reimprimir la comanda" />);
    await userEvent.click(screen.getByRole('button', { name: 'Reimprimir la comanda' }));
    expect(api.reimprimir).toHaveBeenCalledWith(4, 'comanda');
    expect(await screen.findByText('Enviada a la impresora de cocina.')).toBeInTheDocument();
  });

  it('muestra el error de la API', async () => {
    api.reimprimir.mockRejectedValue({
      response: { status: 409, data: { error: 'La cuenta todavía no se ha generado.' } },
    });
    render(<Reimprimir pedidoId={4} tipo="cuenta" />);
    await userEvent.click(screen.getByRole('button', { name: 'Reimprimir cuenta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La cuenta todavía no se ha generado.',
    );
  });
});
