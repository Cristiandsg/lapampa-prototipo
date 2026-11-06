import { useState } from 'react';
import { mensajeDeError, reimprimir } from '../services/api';

const IMPRESORA = { comanda: 'cocina', cuenta: 'caja', comprobante: 'caja' };

// HU16 — Botón "Reimprimir" para la comanda, la cuenta o el comprobante de un pedido.
// La tirilla vuelve a la cola marcada como REIMPRESIÓN y sale por su impresora.
export default function Reimprimir({ pedidoId, tipo, etiqueta = `Reimprimir ${tipo}` }) {
  const [estado, setEstado] = useState(null); // null | 'enviando' | 'listo' | mensaje de error

  async function pedir() {
    setEstado('enviando');
    try {
      await reimprimir(pedidoId, tipo);
      setEstado('listo');
    } catch (err) {
      setEstado(mensajeDeError(err));
    }
  }

  return (
    <div className="reimprimir">
      <button
        type="button"
        className="boton secundario ancho"
        onClick={pedir}
        disabled={estado === 'enviando'}
      >
        {estado === 'enviando' ? 'Enviando…' : etiqueta}
      </button>
      {estado === 'listo' && (
        <p className="aviso-ok" role="status">
          Enviada a la impresora de {IMPRESORA[tipo]}.
        </p>
      )}
      {estado && estado !== 'enviando' && estado !== 'listo' && (
        <p className="alerta" role="alert">
          {estado}
        </p>
      )}
    </div>
  );
}
