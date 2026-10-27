import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import Hoja from '../components/Hoja';
import HojaLinea from '../components/HojaLinea';
import LineaCarta, { pesos } from '../components/LineaCarta';
import { useSesion } from '../sesion/SesionContext';
import { cerrarPedido, mensajeDeError, obtenerPedido, reabrirPedido } from '../services/api';

const ESTADO = {
  abierto: { texto: 'Abierto', chip: 'ocupada' },
  por_cobrar: { texto: 'Por cobrar', chip: 'por-cobrar' },
  pagado: { texto: 'Pagado', chip: 'libre' },
  cancelado: { texto: 'Anulado', chip: 'por-cobrar' },
};

const REFRESCO_MS = 15000; // otro mesero puede estar cambiando el mismo pedido

const MOTIVOS_REABRIR = ['El cliente pidió algo más', 'Error en la cuenta'];

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
    case 'cerrar':
      return 'Generó la cuenta';
    case 'reabrir':
      return 'Reabrió el pedido';
    default:
      return h.accion;
  }
}

// HU04 — El pedido de una mesa: lo que se pidió, el total y la comanda que va a cocina.
// HU05 — Mientras está abierto, el mesero agrega productos, cambia cantidades o notas
// y quita lo que el cliente ya no quiere (con motivo). Todo queda en el historial.
// HU06 — "Generar la cuenta" pasa el pedido a 'por cobrar' y lo manda a la bandeja de caja.
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
  const [hoja, setHoja] = useState(null); // 'cuenta' | 'reabrir'
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState(false);

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
    if (editando || hoja || pedido?.estado !== 'abierto') return undefined;
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') cargar();
    }, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar, editando, hoja, pedido?.estado]);

  const cerrarHoja = useCallback(() => setEditando(null), []);
  const cerrarHojaCuenta = useCallback(() => setHoja(null), []);

  // Corre una acción sobre el pedido (cerrar, reabrir). Si otro celular lo cambió antes,
  // avisa y recarga.
  async function ejecutar(accion, mensaje) {
    setTrabajando(true);
    setAlerta(null);
    try {
      const actualizado = await accion();
      setPedido(actualizado);
      setAjuste(null);
      setAviso(mensaje(actualizado));
    } catch (err) {
      setAviso(null);
      setAlerta(mensajeDeError(err));
      if ([404, 409].includes(err.response?.status)) cargar();
    } finally {
      setHoja(null);
      setTrabajando(false);
    }
  }

  const generarCuenta = () =>
    ejecutar(
      () => cerrarPedido(pedido.id),
      (p) => `Cuenta generada. La mesa «${p.mesa}» pasó a «por cobrar» y ya está en la caja.`,
    );

  const reabrir = () =>
    ejecutar(
      () => reabrirPedido(pedido.id, motivo.trim()),
      () => 'Pedido reabierto. Ya puedes agregar o cambiar productos.',
    );

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

  // El cajero llega desde la caja; meseros y propietario, desde las mesas
  const desdeCaja = usuario.rol === 'cajero';
  const volver = {
    volver: true,
    volverA: desdeCaja ? '/caja' : '/mesas',
    etiquetaVolver: desdeCaja ? 'Volver a caja' : 'Volver a mesas',
  };

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

  const abierto = pedido.estado === 'abierto';
  const puedeEditar = abierto && ['mesero', 'propietario'].includes(usuario.rol);
  const puedeCerrar = abierto && pedido.items.length > 0; // los tres roles
  const porCobrar = pedido.estado === 'por_cobrar';
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

      {puedeCerrar && (
        <button type="button" className="boton ancho" onClick={() => setHoja('cuenta')}>
          Generar la cuenta
        </button>
      )}
      {puedeEditar && (
        <Link to={`/pedidos/${pedido.id}/agregar`} className="boton secundario ancho">
          <span aria-hidden="true">+&nbsp;</span>Agregar productos
        </Link>
      )}

      {porCobrar && (
        <details className="bloque" open>
          <summary>Cuenta para el cliente</summary>
          <pre className="tirilla" aria-label="Cuenta">
            {pedido.cuenta}
          </pre>
          <p className="nota">
            Sale por la impresora de caja cuando esté conectada al sistema. El cobro se registra en
            Caja.
          </p>
          <button
            type="button"
            className="boton secundario ancho"
            onClick={() => {
              setMotivo('');
              setHoja('reabrir');
            }}
          >
            Reabrir pedido
          </button>
        </details>
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

      <Link to={volver.volverA} className="boton secundario ancho">
        {volver.etiquetaVolver}
      </Link>

      {hoja === 'cuenta' && (
        <Hoja
          titulo={`Cuenta de ${pedido.mesa}`}
          onCerrar={cerrarHojaCuenta}
          acciones={
            <button
              type="button"
              className="boton ancho"
              disabled={trabajando}
              onClick={generarCuenta}
            >
              {trabajando ? 'Generando…' : 'Sí, generar la cuenta'}
            </button>
          }
        >
          <pre className="tirilla" aria-label="Vista previa de la cuenta">
            {pedido.cuenta}
          </pre>
          <p className="nota">
            Después de generarla, el pedido ya no se puede cambiar. Si el cliente pide algo más, se
            puede reabrir.
          </p>
        </Hoja>
      )}

      {hoja === 'reabrir' && (
        <Hoja
          titulo="Reabrir pedido"
          onCerrar={cerrarHojaCuenta}
          acciones={
            <button
              type="button"
              className="boton ancho"
              disabled={trabajando || motivo.trim().length < 3}
              onClick={reabrir}
            >
              {trabajando ? 'Reabriendo…' : 'Reabrir pedido'}
            </button>
          }
        >
          <p>La cuenta sale de la caja y el pedido vuelve a quedar abierto.</p>
          <div className="campo">
            <label htmlFor="motivo-reabrir">Motivo</label>
            <div className="chips-motivo" role="group" aria-label="Motivos frecuentes">
              {MOTIVOS_REABRIR.map((m) => (
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
              id="motivo-reabrir"
              maxLength={150}
              placeholder="O escríbelo aquí"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        </Hoja>
      )}

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
