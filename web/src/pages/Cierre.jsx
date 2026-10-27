import { useCallback, useEffect, useState } from 'react';
import Encabezado from '../components/Encabezado';
import { pesos } from '../components/LineaCarta';
import { mensajeDeError, obtenerCierre } from '../services/api';

const MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

const veces = (n, una, varias) => `${n} ${n === 1 ? una : varias}`;

// HU07 — Cierre de caja del día: lo recaudado por medio de pago, el consumo y las propinas.
// HU08 — Propinas por mesero, para liquidarlas al final de la jornada.
// Antes del sistema este cierre tomaba unos 30 minutos a mano (línea base del Sprint 0).
export default function Cierre() {
  const [fecha, setFecha] = useState(''); // vacío = hoy (lo decide la API, en hora de Colombia)
  const [cierre, setCierre] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async (dia) => {
    setError(null);
    try {
      const datos = await obtenerCierre(dia || undefined);
      setCierre(datos);
      setFecha(datos.fecha);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <main className="pagina">
      <Encabezado titulo="Cierre de caja" volver volverA="/caja" etiquetaVolver="Volver a caja" />

      <div className="campo">
        <label htmlFor="fecha-cierre">Día</label>
        <input
          id="fecha-cierre"
          type="date"
          value={fecha}
          onChange={(e) => {
            setFecha(e.target.value);
            if (e.target.value) cargar(e.target.value);
          }}
        />
      </div>

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {!cierre && !error && <p className="nota">Calculando el cierre…</p>}

      {cierre && (
        <>
          <section className="bloque" aria-labelledby="titulo-recaudado">
            <h2 id="titulo-recaudado" className="seccion-titulo">
              Recaudado
            </h2>
            <p className="cifra-grande">{pesos.format(cierre.totalRecaudado)}</p>
            <p className="nota centrado">
              {veces(cierre.pedidosPagados, 'pedido pagado', 'pedidos pagados')}
            </p>
            <dl className="resumen-cobro">
              {cierre.porMedio.map((m) => (
                <div key={m.medio}>
                  <dt>
                    {MEDIO[m.medio]} <small>({veces(m.pagos, 'pago', 'pagos')})</small>
                  </dt>
                  <dd>{pesos.format(m.total)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="bloque" aria-labelledby="titulo-ventas">
            <h2 id="titulo-ventas" className="seccion-titulo">
              Ventas y propinas
            </h2>
            <dl className="resumen-cobro">
              <div>
                <dt>Consumo (ventas del gastrobar)</dt>
                <dd>{pesos.format(cierre.consumo)}</dd>
              </div>
              <div>
                <dt>Propinas (son de los meseros)</dt>
                <dd>{pesos.format(cierre.propinas.total)}</dd>
              </div>
              <div className="resumen-total">
                <dt>Total recaudado</dt>
                <dd>{pesos.format(cierre.totalRecaudado)}</dd>
              </div>
            </dl>
          </section>

          <section className="bloque" aria-labelledby="titulo-propinas">
            <h2 id="titulo-propinas" className="seccion-titulo">
              Propinas por mesero
            </h2>
            {cierre.propinas.porMesero.length === 0 ? (
              <p className="nota centrado">Todavía no hay cobros este día.</p>
            ) : (
              <ul className="lista-propinas">
                {cierre.propinas.porMesero.map((p) => (
                  <li key={p.mesero}>
                    <div className="carta-linea">
                      <span>{p.mesero}</span>
                      <span className="relleno" aria-hidden="true" />
                      <span className="precio">{pesos.format(p.total)}</span>
                    </div>
                    <small>
                      {veces(p.pedidos, 'mesa cobrada', 'mesas cobradas')} · aceptaron {p.aceptadas}{' '}
                      · otro valor {p.modificadas} · sin propina {p.rechazadas}
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {cierre.porCobrar.cantidad > 0 && (
            <p className="alerta">
              Quedan {veces(cierre.porCobrar.cantidad, 'cuenta', 'cuentas')} por cobrar (
              {pesos.format(cierre.porCobrar.total)}). Cóbralas antes de cerrar la caja.
            </p>
          )}
        </>
      )}
    </main>
  );
}
