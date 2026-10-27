import { useCallback, useEffect, useState } from 'react';
import Encabezado from '../components/Encabezado';
import { pesos } from '../components/LineaCarta';
import { listarPorCobrar, mensajeDeError } from '../services/api';
import api from '../services/api';

const REFRESCO_MS = 15000;

function espera(minutos) {
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.floor(minutos / 60);
  return `hace ${h} h ${minutos % 60} min`;
}

// HU06, HU07 y HU08 — Bandeja de caja, pagos y gestión de propina separada del consumo
export default function Caja() {
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);
  const [mensajeExito, setMensajeExito] = useState(null);

  // Estados para el cobro y propina
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [detallePedido, setDetallePedido] = useState(null);
  
  // Propina: 'sugerida' (10%), 'ninguna' (0), o 'otro' (personalizada)
  const [tipoPropina, setTipoPropina] = useState('sugerida');
  const [propinaPersonalizada, setPropinaPersonalizada] = useState('');

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

  // Al seleccionar un pedido, consultamos su detalle y propina sugerida (PRU-82)
  const seleccionarPedidoParaCobro = async (cuenta) => {
    setPedidoSeleccionado(cuenta);
    setError(null);
    setMensajeExito(null);
    setPagos({ efectivo: '', tarjeta: '', transferencia: '' });
    setEfectivoEntregado('');
    setTipoPropina('sugerida');
    setPropinaPersonalizada('');

    try {
      const response = await api.get(`/caja/pedidos/${cuenta.id}/detalle`);
      setDetallePedido(response.data.pedido);
    } catch (err) {
      console.error('Error al cargar detalle del pedido:', err);
      setError('No se pudo obtener la propina sugerida del pedido.');
    }
  };

  // Cálculo del valor de la propina final según la elección
  const subtotalConsumo = detallePedido ? Number(detallePedido.subtotal) : 0;
  const propinaSugerida = detallePedido ? Number(detallePedido.propinaSugerida) : Math.round(subtotalConsumo * 0.10);

  let valorPropinaFinal = 0;
  if (tipoPropina === 'sugerida') {
    valorPropinaFinal = propinaSugerida;
  } else if (tipoPropina === 'otro') {
    valorPropinaFinal = Number(propinaPersonalizada) || 0;
  } else {
    valorPropinaFinal = 0; // ninguna / rechazada
  }

  const totalAPagar = subtotalConsumo + valorPropinaFinal;

  const totalPagado = 
    (Number(pagos.efectivo) || 0) + 
    (Number(pagos.tarjeta) || 0) + 
    (Number(pagos.transferencia) || 0);

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

    if (Math.abs(totalPagado - totalAPagar) > 0.01) {
      setError(`La suma de los pagos ($${totalPagado}) no coincide exactamente con el total requerido ($${totalAPagar}).`);
      return;
    }

    try {
      // Registrar pago y propina en el backend (PRU-83)
      await api.post(`/caja/pedidos/${pedidoSeleccionado.id}/pagos`, {
        pagos: listaPagos,
        cajeroId: 2, // Cajero de prueba predeterminado
        valorPropina: valorPropinaFinal
      });

      setMensajeExito(`¡Pago y propina del pedido #${pedidoSeleccionado.id} registrados con éxito!`);
      setPedidoSeleccionado(null);
      setDetallePedido(null);
      setPagos({ efectivo: '', tarjeta: '', transferencia: '' });
      setEfectivoEntregado('');
      cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  };

  const totalCuentas = cuentas?.reduce((s, c) => s + c.subtotal, 0) ?? 0;

  return (
    <main className="pagina">
      <Encabezado titulo="Caja" volver />

      {error && <p className="alerta" role="alert">{error}</p>}
      {mensajeExito && <p className="exito" role="alert" style={{ color: 'green', marginBottom: '10px', fontWeight: 'bold' }}>{mensajeExito}</p>}

      {!cuentas && !error && <p className="nota">Cargando las cuentas…</p>}

      {cuentas && (
        <section className="bloque" aria-labelledby="titulo-por-cobrar">
          <div className="fila-titulo">
            <h2 id="titulo-por-cobrar" className="seccion-titulo">Por cobrar</h2>
            <span className="chip por-cobrar">{cuentas.length}</span>
          </div>

          {cuentas.length === 0 ? (
            <p className="nota centrado">No hay cuentas por cobrar.</p>
          ) : (
            <ul className="lista-cuentas">
              {cuentas.map((c) => (
                <li key={c.id}>
                  <div 
                    onClick={() => seleccionarPedidoParaCobro(c)} 
                    className="cuenta-caja" 
                    style={{ cursor: 'pointer', background: pedidoSeleccionado?.id === c.id ? '#e0f7fa' : 'transparent' }}
                  >
                    <span className="cuenta-mesa">{c.mesa ?? 'Domicilio'}</span>
                    <span className="cuenta-total">{pesos.format(c.subtotal)}</span>
                    <span className="cuenta-detalle">
                      Pedido #{c.id} · {c.productos} {c.productos === 1 ? 'producto' : 'productos'} · {c.mesero}
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
              <span>{pesos.format(totalCuentas)}</span>
            </div>
          )}
        </section>
      )}

      {/* Panel de Cobro y Gestión de Propina (HU08) */}
      {pedidoSeleccionado && detallePedido && (
        <section className="bloque" style={{ border: '2px solid #00acc1', padding: '15px', marginTop: '20px', borderRadius: '8px' }}>
          <h3>Cobrar Pedido #{pedidoSeleccionado.id} ({pedidoSeleccionado.mesa ?? 'Domicilio'})</h3>
          <p><strong>Mesero Atendió:</strong> {detallePedido.mesero_nombre || 'No asignado'}</p>

          <div style={{ background: '#fcfcfc', padding: '10px', margin: '10px 0', border: '1px solid #ddd', borderRadius: '4px' }}>
            <p><strong>Consumo (Subtotal):</strong> {pesos.format(subtotalConsumo)}</p>
            
            {/* Sección de Propina Separada (Ley 1935 de 2018 / Criterio HU08) */}
            <div style={{ marginTop: '10px', borderTop: '1px dashed #ccc', paddingTop: '8px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>
                Propina Sugerida (10%): {pesos.format(propinaSugerida)}
              </label>
              
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                <label>
                  <input 
                    type="radio" 
                    name="tipoPropina" 
                    value="sugerida" 
                    checked={tipoPropina === 'sugerida'} 
                    onChange={() => setTipoPropina('sugerida')}
                  /> Aceptar sugerida ({pesos.format(propinaSugerida)})
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="tipoPropina" 
                    value="otro" 
                    checked={tipoPropina === 'otro'} 
                    onChange={() => setTipoPropina('otro')}
                  /> Otro valor
                </label>
                <label>
                  <input 
                    type="radio" 
                    name="tipoPropina" 
                    value="ninguna" 
                    checked={tipoPropina === 'ninguna'} 
                    onChange={() => setTipoPropina('ninguna')}
                  /> Ninguna ($0)
                </label>
              </div>

              {tipoPropina === 'otro' && (
                <div style={{ marginBottom: '8px' }}>
                  <input 
                    type="number" 
                    placeholder="Ingrese valor de propina personalizado"
                    value={propinaPersonalizada}
                    onChange={(e) => setPropinaPersonalizada(e.target.value)}
                    style={{ width: '100%', padding: '6px' }}
                  />
                </div>
              )}

              <p style={{ color: '#00796b', fontWeight: 'bold', margin: '5px 0' }}>
                Propina Final Registrada: {pesos.format(valorPropinaFinal)}
              </p>
            </div>

            <p style={{ fontSize: '1.1em', fontWeight: 'bold', marginTop: '10px', borderTop: '1px solid #bbb', paddingTop: '5px' }}>
              Total a Pagar (Consumo + Propina): {pesos.format(totalAPagar)}
            </p>
          </div>

          <form onSubmit={handlePagarSubmit}>
            <h4>Medios de Pago</h4>
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
                <label>Efectivo entregado por el cliente:</label>
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
              Suma Ingresada: {pesos.format(totalPagado)}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="boton primario" style={{ flex: 1 }}>
                Confirmar Pago y Registrar Propina
              </button>
              <button 
                type="button" 
                className="boton secundario" 
                onClick={() => { setPedidoSeleccionado(null); setDetallePedido(null); }}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </section>
      )}

      <p className="nota">
        Haz clic en una cuenta para ver el desglose de consumo, aceptar la propina sugerida del 10%, modificarla o rechazarla.
      </p>
    </main>
  );
}