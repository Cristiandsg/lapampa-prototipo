import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import HojaLinea from '../components/HojaLinea';
import LineaCarta, { pesos } from '../components/LineaCarta';
import { useSesion } from '../sesion/SesionContext';
import { mensajeDeError, obtenerPedido } from '../services/api';

const ESTADO = {
  abierto: { texto: 'Abierto', chip: 'ocupada' },
  por_cobrar: { texto: 'Por cobrar', chip: 'por-cobrar' },
  pagado: { texto: 'Pagado', chip: 'libre' },
  cancelado: { texto: 'Anulado', chip: 'por-cobrar' },
};

const REFRESCO_MS = 15000; // otro mesero puede estar cambiando el mismo pedido

function hora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Cómo se lee cada registro del historial del pedido (historial_cambio)
function textoCambio(h) {
  switch (h.accion) {
    case 'crear':
      return 'Abrió el pedido';
    case 'agregar_item':
      return `Agregó ${h.valor_nuevo}`;
    case 'cambiar_item':
      return `Cambió ${h.valor_anterior} → ${h.valor_nuevo}`;
    case 'quitar_item':
      return `Quitó ${h.valor_anterior}`;
    case 'anular':
      return 'Anuló el pedido';
    default:
      return h.accion;
  }
}

// HU04 — El pedido de una mesa: lo que se pidió, el total y la comanda que va a cocina.
// HU05 — Mientras está abierto, el mesero agrega productos, cambia cantidades o notas
// y quita lo que el cliente ya no quiere (con motivo). Todo queda en el historial.
export default function VerPedido() {
  const { id } = useParams();
  const { state, pathname } = useLocation();
  const navigate = useNavigate();
  const { usuario } = useSesion();
  const [pedido, setPedido] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [alerta, setAlerta] = useState(null);
  const [aviso, setAviso] = useState(() =>
    state?.recienEnviado ? 'recien-enviado' : (state?.aviso ?? null),
  );
  const [ajuste, setAjuste] = useState(state?.ajuste ?? null);
  const [editando, setEditando] = useState(null); // línea abierta en la hoja

  const cargar = useCallback(async () => {
    try {
      setPedido(await obtenerPedido(id));
    } catch (err) {
      setErrorCarga(mensajeDeError(err));
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // El aviso de "enviado a cocina" es de una sola vez: si recargan la página, no vuelve a salir
  useEffect(() => {
    if (state) navigate(pathname, { replace: true, state: null });
  }, [state, pathname, navigate]);

  // Se actualiza solo, pero no mientras la hoja de cambios está abierta
  useEffect(() => {
    if (editando || pedido?.estado !== 'abierto') return undefined;
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar, editando, pedido?.estado]);

  const cerrarHoja = useCallback(() => setEditando(null), []);

  function alGuardar(actualizado) {
    setEditando(null);
    setAlerta(null);
    setPedido(actualizado);
    setAjuste(actualizado.ajuste);
    if (actualizado.estado === 'cancelado') {
      setAviso(`Pedido anulado. La mesa «${actualizado.mesa}» quedó libre.`);
    } else {
      setAviso(actualizado.ajuste ? 'Cambio enviado a cocina.' : 'No hubo cambios.');
    }
  }

  function alConflicto(mensaje) {
    setEditando(null);
    setAviso(null);
    setAlerta(`${mensaje} Se actualizó el pedido con lo último.`);
    cargar();
  }

  const volver = { volver: true, volverA: '/mesas', etiquetaVolver: 'Volver a mesas' };

  if (errorCarga) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" {...volver} />
        <p className="alerta" role="alert">
          {errorCarga}
        </p>
      </main>
    );
  }
  if (!pedido) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" {...volver} />
        <p className="nota">Cargando el pedido…</p>
      </main>
    );
  }

  const puedeEditar =
    pedido.estado === 'abierto' && ['mesero', 'propietario'].includes(usuario.rol);
  const estado = ESTADO[pedido.estado];

  return (
    <main className="pagina">
      <Encabezado
        titulo={pedido.mesa ?? 'Pedido'}
        subtitulo={`Pedido #${pedido.id} · ${hora(pedido.creado_en)} · ${pedido.mesero}`}
        {...volver}
      />

      {aviso && (
        <p className="aviso-ok" role="status">
          {aviso === 'recien-enviado'
            ? `Pedido #${pedido.id} enviado a cocina. La mesa quedó ocupada.`
            : aviso}
        </p>
      )}
      {alerta && (
        <p className="alerta" role="alert">
          {alerta}
        </p>
      )}

      <section className="bloque" aria-labelledby="titulo-detalle">
        <div className="fila-titulo">
          <h2 id="titulo-detalle" className="seccion-titulo">
            Pedido
          </h2>
          <span className={`chip ${estado.chip}`}>{estado.texto}</span>
        </div>
        {pedido.items.length === 0 ? (
          <p className="nota">Este pedido se anuló: no tiene productos.</p>
        ) : (
          <ul className="carta">
            {pedido.items.map((i) => (
              <LineaCarta
                key={i.id}
                nombre={`${i.cantidad} × ${i.nombre}`}
                precio={i.total}
                descripcion={i.nota ? `Nota: ${i.nota}` : null}
                className="linea-pedido"
              >
                {puedeEditar && (
                  <button
                    type="button"
                    className="boton secundario chico"
                    aria-label={`Cambiar ${i.nombre}`}
                    onClick={() => {
                      setAlerta(null);
                      setEditando(i);
                    }}
                  >
                    Cambiar
                  </button>
                )}
              </LineaCarta>
            ))}
          </ul>
        )}
        {pedido.observaciones && <p className="nota-producto">Obs.: {pedido.observaciones}</p>}
        <div className="total-pedido">
          <span>Total</span>
          <span>{pesos.format(pedido.subtotal)}</span>
        </div>
      </section>

      {puedeEditar && (
        <Link to={`/pedidos/${pedido.id}/agregar`} className="boton ancho">
          <span aria-hidden="true">+&nbsp;</span>Agregar productos
        </Link>
      )}

      {ajuste && (
        <details className="bloque" open>
          <summary>Lo último que se envió a cocina</summary>
          <pre className="tirilla" aria-label="Ajuste enviado a cocina">
            {ajuste}
          </pre>
        </details>
      )}

      {pedido.items.length > 0 && (
        <details className="bloque">
          <summary>Ver la comanda de cocina</summary>
          <pre className="tirilla" aria-label="Comanda de cocina">
            {pedido.comanda}
          </pre>
          <p className="nota">Sale por la impresora de cocina cuando esté conectada al sistema.</p>
        </details>
      )}

      {pedido.historial?.length > 0 && (
        <details className="bloque">
          <summary>Cambios del pedido ({pedido.historial.length})</summary>
          <ol className="historial">
            {pedido.historial.map((h) => (
              <li key={h.id}>
                <span className="historial-quien">
                  {hora(h.creado_en)} · {h.usuario ?? 'Cliente'}
                </span>
                <span>{textoCambio(h)}</span>
                {h.motivo && <span className="historial-motivo">Motivo: {h.motivo}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <Link to="/mesas" className="boton secundario ancho">
        Volver a mesas
      </Link>

      {editando && (
        <HojaLinea
          pedido={pedido}
          linea={editando}
          onCerrar={cerrarHoja}
          onGuardado={alGuardar}
          onConflicto={alConflicto}
        />
      )}
    </main>
  );
}
