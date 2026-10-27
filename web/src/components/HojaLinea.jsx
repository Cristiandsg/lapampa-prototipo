import { useEffect, useRef, useState } from 'react';
import { pesos } from './LineaCarta';
import { cambiarLineaPedido, mensajeDeError, quitarDelPedido } from '../services/api';

// Motivos que más se repiten en el local: se tocan en vez de escribirlos
const MOTIVOS = [
  'El cliente cambió de opinión',
  'Error al tomar el pedido',
  'Se demoró mucho',
  'Se acabó en cocina',
];

// HU05 — Hoja para cambiar un producto de un pedido abierto: cantidad, nota o quitarlo.
// Todo lo del pedido ya se envió a cocina, así que bajar la cantidad o quitarlo pide motivo.
// onGuardado(pedidoActualizado) · onConflicto(mensaje): otro celular cambió el pedido antes.
export default function HojaLinea({ pedido, linea, onCerrar, onGuardado, onConflicto }) {
  const [cantidad, setCantidad] = useState(linea.cantidad);
  const [nota, setNota] = useState(linea.nota ?? '');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const botonCerrar = useRef(null);

  useEffect(() => {
    botonCerrar.current?.focus();
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const quitar = cantidad === 0;
  const baja = cantidad < linea.cantidad;
  const unica = pedido.items.length === 1;
  const motivoListo = motivo.trim().length >= 3;
  const huboCambio = cantidad !== linea.cantidad || nota.trim() !== (linea.nota ?? '');
  const totalNuevo = pedido.subtotal - linea.total + linea.precio_unitario * cantidad;

  async function guardar(evento) {
    evento.preventDefault();
    if (!huboCambio || (baja && !motivoListo) || guardando) return;
    setError(null);
    setGuardando(true);
    try {
      const actualizado = quitar
        ? await quitarDelPedido(pedido.id, linea.id, motivo.trim())
        : await cambiarLineaPedido(pedido.id, linea.id, {
            cantidad,
            nota: nota.trim() || null,
            ...(baja && { motivo: motivo.trim() }),
          });
      onGuardado(actualizado);
    } catch (err) {
      const status = err.response?.status;
      if (status === 404 || status === 409) return onConflicto(mensajeDeError(err));
      setError(mensajeDeError(err));
      setGuardando(false);
    }
  }

  let textoBoton = 'Guardar cambio';
  if (quitar) textoBoton = unica ? 'Sí, anular el pedido' : 'Quitar del pedido';
  if (guardando) textoBoton = 'Guardando…';

  return (
    <div className="fondo-hoja" onClick={onCerrar}>
      <form
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-linea"
        onClick={(e) => e.stopPropagation()}
        onSubmit={guardar}
        noValidate
      >
        <div className="hoja-cabeza">
          <h2 id="titulo-linea">{linea.nombre}</h2>
          <span className="precio">{pesos.format(linea.precio_unitario)} c/u</span>
        </div>

        <div className="fila-cantidad">
          <span>Cantidad</span>
          <div className="contador" role="group" aria-label={`Cantidad de ${linea.nombre}`}>
            <button
              type="button"
              className="boton-redondo"
              aria-label="Quitar uno"
              disabled={cantidad === 0}
              onClick={() => setCantidad((c) => Math.max(0, c - 1))}
            >
              −
            </button>
            <span aria-live="polite">{cantidad}</span>
            <button
              type="button"
              className="boton-redondo lleno"
              aria-label="Agregar uno"
              disabled={cantidad === 99}
              onClick={() => setCantidad((c) => Math.min(99, c + 1))}
            >
              +
            </button>
          </div>
        </div>

        {!quitar && (
          <div className="campo">
            <label htmlFor="nota-linea">Nota para cocina</label>
            <input
              id="nota-linea"
              maxLength={120}
              placeholder="Ej.: sin cebolla, término medio"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        )}

        {baja && (
          <div className="campo">
            <label htmlFor="motivo-linea">Motivo (obligatorio: ya se envió a cocina)</label>
            <div className="chips-motivo" role="group" aria-label="Motivos frecuentes">
              {MOTIVOS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="filtro"
                  aria-pressed={motivo === m}
                  onClick={() => setMotivo(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              id="motivo-linea"
              maxLength={150}
              placeholder="O escríbelo aquí"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        )}

        {quitar && unica && (
          <p className="alerta">
            Es el único producto: el pedido #{pedido.id} se anula y la mesa «{pedido.mesa}» queda
            libre.
          </p>
        )}

        {!(quitar && unica) && (
          <p className="total-hoja">
            <span>Total del pedido</span>
            <strong>{pesos.format(totalNuevo)}</strong>
          </p>
        )}

        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className={`boton ancho ${quitar ? 'peligro' : ''}`}
          disabled={!huboCambio || (baja && !motivoListo) || guardando}
        >
          {textoBoton}
        </button>
        <button
          type="button"
          ref={botonCerrar}
          className="boton secundario ancho"
          onClick={onCerrar}
        >
          Cancelar
        </button>
      </form>
    </div>
  );
}
