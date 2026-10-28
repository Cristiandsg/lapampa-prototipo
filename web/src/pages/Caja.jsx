import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
// HU07/HU08 — Al tocar una cuenta se cobra (propina, pago mixto y vueltas) y desde aquí se
// consulta el cierre de caja del día.
export default function Caja() {
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  const [cuentas, setCuentas] = useState(null);
  const [error, setError] = useState(null);
  const [aviso] = useState(state?.aviso ?? null);

  // El aviso de "pago registrado" es de una sola vez
  useEffect(() => {
    if (state) navigate(pathname, { replace: true, state: null });
  }, [state, pathname, navigate]);

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

      {aviso && (
        <p className="aviso-ok" role="status">
          {aviso}
        </p>
      )}

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
                  <Link
                    to={`/caja/cobrar/${c.id}`}
                    className="cuenta-caja"
                    aria-label={`Cobrar ${c.mesa ?? 'domicilio'}, ${pesos.format(c.subtotal)}`}
                  >
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

      <Link to="/caja/cierre" className="boton secundario ancho">
        Cierre de caja del día
      </Link>

      <p className="nota">
        Aquí llegan las cuentas que generan los meseros. Toca una para cobrarla.
      </p>
    </main>
  );
}
