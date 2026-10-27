import { useCallback, useEffect, useState } from 'react';
import Encabezado from '../components/Encabezado';
import { pesos } from '../components/LineaCarta';
import { listarPorCobrar, mensajeDeError } from '../services/api';
import api from '../services/api';

const REFRESCO_MS = 15000; // las cuentas llegan desde los celulares de los meseros

function espera(minutos) {
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.floor(minutos / 60);
  return `hace ${h} h ${minutos % 60} min`;
}

// HU06 y HU07 — Bandeja del cajero y registro de pagos (Efectivo, Tarjeta, Transferencia y Mixto)
export default function Caja() {
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Estado para el modal o panel de pago del pedido seleccionado
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [pagos, setPagos] = useState({ efectivo: '', tarjeta: '', transferencia: '' });
  const [efectivoEntregado, setEfectivoEntregado] = useState('');

  const cargar = useCallback(async () => {
    try {
      setCuentas(await listarPorCobrar());
      setError(null);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Cálculos para el pago
  const totalPagado = 
    (Number(pagos.efectivo) || 0) + 
    (Number(pagos.tarjeta) || 0) + 
    (Number(pagos.transferencia) || 0);

  const totalPedido = pedidoSeleccionado ? Number(pedidoSeleccionado.subtotal) : 0;
  
  // Cálculo de vueltas
  const efectivoNum = Number(efectivoEntregado) || 0;
  const efectivoAbonado = Number(pagos.efectivo) || 0;
  const vueltas = efectivoNum > efectivoAbonado ? efectivoNum - efectivoAbonado : 0;

  const handlePagarSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMensajeExito(null);

    if (!pedidoSeleccionado) return;

    const listaPagos = [];
    if (Number(pagos.efectivo) > 0) listaPagos.push({ medio: 'efectivo', valor: Number(pagos.efectivo) });
    if (Number(pagos.tarjeta) > 0) listaPagos.push({ medio: 'tarjeta', valor: Number(pagos.tarjeta) });
    if (Number(pagos.transferencia) > 0) listaPagos.push({ medio: 'transferencia', valor: Number(pagos.transferencia) });

    if (listaPagos.length === 0) {
      setError('Debe ingresar al menos un medio de pago.');
      return;
    }

    if (Math.abs(totalPagado - totalPedido) > 0.01) {
      setError(`La suma de los pagos ($${totalPagado}) no coincide exactamente con el total del pedido ($${totalPedido}).`);
      return;
    }

    try {
      // Cajero de prueba por defecto (ID 2 según seed.sql)
      await api.post(`/caja/pedidos/${pedidoSeleccionado.id}/pagos`, {
        pagos: listaPagos,
        cajeroId: 2
      });

      setMensajeExito(`¡Pago del pedido #${pedidoSeleccionado.id} registrado exitosamente!`);
      setPedidoSeleccionado(null);
      setPagos({ efectivo: '', tarjeta: '', transferencia: '' });
      setEfectivoEntregado('');
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const total = cuentas?.reduce((s, c) => s + c.subtotal, 0) ?? 0;

  return (
    <main className="pagina">
      <Encabezado titulo="Caja" volver />

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {mensajeExito && (
        <p className="exito" role="alert" style={{ color: 'green', marginBottom: '10px', fontWeight: 'bold' }}>
          {mensajeExito}
        </p>
      )}

      {!cuentas && !error && <p className="nota">Cargando las cuentas…</p>}

      {cuentas && (
        <section className="bloque" aria-labelledby="titulo-por-cobrar">
          <div className="fila-titulo">
            <h2 id="titulo-por-cobrar" className="seccion-titulo">
              Por cobrar
            </h2>
            <span className="chip por-cobrar">{cuentas.length}</span>
          </div>

          {cuentas.length === 0 ? (
            <p className="nota centrado">No hay cuentas por cobrar.</p>
          ) : (
            <ul className="lista-cuentas">
              {cuentas.map((c) => (
                <li key={c.id}>
                  <div 
                    onClick={() => setPedidoSeleccionado(c)} 
                    className="cuenta-caja" 
                    style={{ cursor: 'pointer', background: pedidoSeleccionado?.id === c.id ? '#e0f7fa' : 'transparent' }}
                  >
                    <span className="cuenta-mesa">{c.mesa ?? 'Domicilio'}</span>
                    <span className="cuenta-total">{pesos.format(c.subtotal)}</span>
                    <span className="cuenta-detalle">
                      Pedido #{c.id} · {c.productos} {c.productos === 1 ? 'producto' : 'productos'}{' '}
                      · {c.mesero}
                    </span>
                    <span className="cuenta-detalle">Cuenta {espera(c.minutos)} (Clic para cobrar)</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {cuentas.length > 1 && (
            <div className="total-pedido">
              <span>Total por cobrar</span>
              <span>{pesos.format(total)}</span>
            </div>
          )}
        </section>
      )}

      {/* Panel de Cobro si hay un pedido seleccionado */}
      {pedidoSeleccionado && (
        <section className="bloque" style={{ border: '2px solid #00acc1', padding: '15px', marginTop: '20px', borderRadius: '8px' }}>
          <h3>Cobrar Pedido #{pedidoSeleccionado.id} ({pedidoSeleccionado.mesa ?? 'Domicilio'})</h3>
          <p><strong>Total a pagar:</strong> {pesos.format(totalPedido)}</p>

          <form onSubmit={handlePagarSubmit}>
            <div style={{ marginBottom: '10px' }}>
              <label>Efectivo:</label>
              <input 
                type="number" 
                value={pagos.efectivo} 
                onChange={(e) => setPagos({ ...pagos, efectivo: e.target.value })}
                placeholder="0"
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>

            {Number(pagos.efectivo) > 0 && (
              <div style={{ marginBottom: '10px', background: '#f5f5f5', padding: '10px' }}>
                <label>Efectivo entregado por el cliente (para calcular vueltas):</label>
                <input 
                  type="number" 
                  value={efectivoEntregado} 
                  onChange={(e) => setEfectivoEntregado(e.target.value)}
                  placeholder="Dinero recibido"
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
                <p style={{ marginTop: '5px', color: '#00796b', fontWeight: 'bold' }}>
                  Vueltas: {pesos.format(vueltas >= 0 ? vueltas : 0)}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '10px' }}>
              <label>Tarjeta:</label>
              <input 
                type="number" 
                value={pagos.tarjeta} 
                onChange={(e) => setPagos({ ...pagos, tarjeta: e.target.value })}
                placeholder="0"
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Transferencia:</label>
              <input 
                type="number" 
                value={pagos.transferencia} 
                onChange={(e) => setPagos({ ...pagos, transferencia: e.target.value })}
                placeholder="0"
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>

            <p style={{ fontWeight: 'bold', margin: '10px 0' }}>
              Suma ingresada: {pesos.format(totalPagado)}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="boton primario" style={{ flex: 1 }}>
                Confirmar Pago y Cerrar
              </button>
              <button 
                type="button" 
                className="boton secundario" 
                onClick={() => setPedidoSeleccionado(null)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <p className="nota">
        Haz clic en cualquier cuenta de la lista para desplegar el formulario de cobro (efectivo, tarjeta, transferencia o mixto).
      </p>
    </main>
  );
}