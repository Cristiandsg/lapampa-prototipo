import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import { pesos } from '../components/LineaCarta';
import { listarPorCobrar, mensajeDeError } from '../services/api';

const REFRESCO_MS = 15000; // las cuentas llegan desde los celulares de los meseros

function espera(minutos) {
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.floor(minutos / 60);
  return `hace ${h} h ${minutos % 60} min`;
}

// HU06 — Bandeja del cajero: las cuentas que los meseros generaron y faltan por cobrar.
// El cobro (efectivo, tarjeta, transferencia y propina) llega con HU07 y HU08.
export default function Caja() {
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);

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

  const total = cuentas?.reduce((s, c) => s + c.subtotal, 0) ?? 0;

  return (
    <main className="pagina">
      <Encabezado titulo="Caja" volver />

      {error && (
        <p className="alerta" role="alert">
          {error}
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
                  <Link to={`/pedidos/${c.id}`} className="cuenta-caja">
                    <span className="cuenta-mesa">{c.mesa ?? 'Domicilio'}</span>
                    <span className="cuenta-total">{pesos.format(c.subtotal)}</span>
                    <span className="cuenta-detalle">
                      Pedido #{c.id} · {c.productos} {c.productos === 1 ? 'producto' : 'productos'}{' '}
                      · {c.mesero}
                    </span>
                    <span className="cuenta-detalle">Cuenta {espera(c.minutos)}</span>
                  </Link>
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

      <p className="nota">
        Aquí llegan las cuentas que generan los meseros. Registrar el pago (efectivo, tarjeta o
        transferencia) y la propina llega en las siguientes historias del Sprint 2.
      </p>
    </main>
  );
}
