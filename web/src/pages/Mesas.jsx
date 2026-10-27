import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import { pesos } from '../components/LineaCarta';
import { useSesion } from '../sesion/SesionContext';
import {
  crearMesa,
  eliminarMesa,
  listarMesas,
  mensajeDeError,
  quitarMesasLibres,
  renombrarMesa,
} from '../services/api';

const ESTADOS = {
  libre: { texto: 'Libre', chip: 'libre' },
  ocupada: { texto: 'Ocupada', chip: 'ocupada' },
  por_cobrar: { texto: 'Por cobrar', chip: 'por-cobrar' },
};

const FILTROS = [
  { valor: 'todas', texto: 'Todas' },
  { valor: 'libre', texto: 'Libres' },
  { valor: 'ocupada', texto: 'Ocupadas' },
  { valor: 'por_cobrar', texto: 'Por cobrar' },
];

const REFRESCO_MS = 15000; // varios meseros trabajan a la vez: se actualiza solo

function duracion(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function detalle(mesa) {
  if (!mesa.pedido) return 'Toca para abrir pedido';
  const total = pesos.format(mesa.pedido.total);
  return mesa.estado === 'por_cobrar'
    ? `${total} · en caja`
    : `${total} · ${duracion(mesa.pedido.minutos)}`;
}

// HU03 — Mesas de la jornada (pantalla 2 de los mockups aprobados).
// No hay mesas fijas: el mesero crea las que necesite con el nombre que quiera.
export default function Mesas() {
  const { usuario } = useSesion();
  const navigate = useNavigate();
  const [mesas, setMesas] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  const [creando, setCreando] = useState(false);
  const [nombreNueva, setNombreNueva] = useState('');
  const [guardando, setGuardando] = useState(false);
  // Mesa elegida para ver sus opciones (renombrar, eliminar)
  const [elegida, setElegida] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const campoNueva = useRef(null);
  const botonCerrarHoja = useRef(null);

  const cargar = useCallback(async () => {
    try {
      setMesas(await listarMesas());
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

  useEffect(() => {
    if (creando) campoNueva.current?.focus();
  }, [creando]);

  // Al abrir la hoja de opciones, el foco va a ella; se cierra con Escape
  const idElegida = elegida?.id;
  useEffect(() => {
    if (idElegida) botonCerrarHoja.current?.focus();
  }, [idElegida]);

  useEffect(() => {
    if (!elegida) return undefined;
    const alTeclear = (e) => e.key === 'Escape' && setElegida(null);
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [elegida]);

  function limpiarAvisos() {
    setError(null);
    setExito(null);
  }

  async function crear(evento) {
    evento.preventDefault();
    limpiarAvisos();
    const nombre = nombreNueva.trim();
    if (!nombre) return setError('Escribe el nombre de la mesa.');
    setGuardando(true);
    try {
      const mesa = await crearMesa(nombre);
      setExito(`Mesa "${mesa.nombre}" creada.`);
      setNombreNueva('');
      setCreando(false);
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  function abrirOpciones(mesa) {
    limpiarAvisos();
    setElegida(mesa);
    setNuevoNombre(mesa.nombre);
    setConfirmarEliminar(false);
  }

  async function renombrar(evento) {
    evento.preventDefault();
    const nombre = nuevoNombre.trim();
    if (!nombre || nombre === elegida.nombre) return setElegida(null);
    try {
      await renombrarMesa(elegida.id, nombre);
      setExito(`"${elegida.nombre}" ahora se llama "${nombre}".`);
      setElegida(null);
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  async function eliminar() {
    if (!confirmarEliminar) return setConfirmarEliminar(true);
    try {
      await eliminarMesa(elegida.id);
      setExito(`Mesa "${elegida.nombre}" eliminada.`);
      setElegida(null);
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  async function quitarLibres() {
    limpiarAvisos();
    if (
      !window.confirm('¿Quitar todas las mesas libres? Las que tienen pedido abierto se quedan.')
    ) {
      return;
    }
    try {
      const cantidad = await quitarMesasLibres();
      setExito(
        cantidad === 0
          ? 'No había mesas libres para quitar.'
          : `Se ${cantidad === 1 ? 'quitó 1 mesa libre' : `quitaron ${cantidad} mesas libres`}.`,
      );
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  const cuenta = (estado) =>
    mesas ? mesas.filter((m) => estado === 'todas' || m.estado === estado).length : 0;
  const visibles = mesas?.filter((m) => filtro === 'todas' || m.estado === filtro) ?? [];
  const hayLibres = mesas?.some((m) => m.estado === 'libre' && !m.pedido);

  return (
    <main className="pagina">
      <Encabezado titulo="Mesas de hoy" volver={usuario.rol !== 'mesero'} />

      {creando ? (
        <form className="bloque formulario" onSubmit={crear} noValidate>
          <div className="campo">
            <label htmlFor="nombre-mesa">Nombre de la mesa</label>
            <input
              id="nombre-mesa"
              ref={campoNueva}
              maxLength={40}
              placeholder="Ej.: Terraza 2, Barra, Cumpleaños Andrea"
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
            />
          </div>
          <div className="acciones">
            <button type="button" className="boton secundario" onClick={() => setCreando(false)}>
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? 'Creando…' : 'Crear mesa'}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="boton ancho"
          onClick={() => {
            limpiarAvisos();
            setCreando(true);
          }}
        >
          <span aria-hidden="true">+&nbsp;</span>Nueva mesa
        </button>
      )}

      {error && !elegida && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {exito && (
        <p className="aviso-ok" role="status">
          {exito}
        </p>
      )}

      {mesas && mesas.length > 0 && (
        <div className="filtros" role="group" aria-label="Filtrar mesas">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className="filtro"
              aria-pressed={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
            >
              {f.texto} ({cuenta(f.valor)})
            </button>
          ))}
        </div>
      )}

      {!mesas && !error && <p className="nota">Cargando mesas…</p>}

      {mesas && mesas.length === 0 && (
        <section className="bloque centrado">
          <h2 className="seccion-titulo">Todavía no hay mesas</h2>
          <p>Crea la primera con «Nueva mesa». Ponle el nombre que quieras.</p>
        </section>
      )}

      {visibles.length > 0 && (
        <ul className="mesas" aria-label="Mesas">
          {visibles.map((m) => (
            <li key={m.id} className="mesa-celda">
              {/* Libre: abre el pedido (HU04). Con pedido: muestra el pedido. */}
              <button
                type="button"
                className="mesa"
                onClick={() =>
                  navigate(m.pedido ? `/pedidos/${m.pedido.id}` : `/mesas/${m.id}/pedido`)
                }
              >
                <span className="mesa-nombre">{m.nombre}</span>
                <span className={`chip ${ESTADOS[m.estado].chip}`}>{ESTADOS[m.estado].texto}</span>
                <span className="mesa-detalle">{detalle(m)}</span>
              </button>
              <button
                type="button"
                className="mesa-opciones"
                aria-label={`Opciones de ${m.nombre}`}
                onClick={() => abrirOpciones(m)}
              >
                <span aria-hidden="true">⋯</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {mesas && mesas.length > 0 && visibles.length === 0 && (
        <p className="nota">No hay mesas en este estado.</p>
      )}

      <p className="nota">
        Las mesas las creas tú con el nombre que quieras. Una mesa con pedido abierto no se puede
        eliminar.
      </p>

      {hayLibres && (
        <button type="button" className="boton secundario ancho" onClick={quitarLibres}>
          Cerrar jornada: quitar mesas libres
        </button>
      )}

      {elegida && (
        <div className="fondo-hoja" onClick={() => setElegida(null)}>
          <section
            className="hoja"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-hoja"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hoja-cabeza">
              <h2 id="titulo-hoja">{elegida.nombre}</h2>
              <span className={`chip ${ESTADOS[elegida.estado].chip}`}>
                {ESTADOS[elegida.estado].texto}
              </span>
            </div>

            {error && (
              <p className="alerta" role="alert">
                {error}
              </p>
            )}

            {elegida.estado === 'libre' && !elegida.pedido ? (
              <>
                <form className="fila-formulario" onSubmit={renombrar}>
                  <div className="campo">
                    <label htmlFor="renombrar-mesa">Cambiar nombre</label>
                    <input
                      id="renombrar-mesa"
                      maxLength={40}
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="boton">
                    Guardar
                  </button>
                </form>
                <button type="button" className="boton peligro ancho" onClick={eliminar}>
                  {confirmarEliminar ? `Sí, eliminar «${elegida.nombre}»` : 'Eliminar mesa'}
                </button>
              </>
            ) : (
              <p>
                Tiene un pedido abierto ({detalle(elegida)}). No se puede renombrar ni eliminar
                hasta que se pague.
              </p>
            )}

            <button
              type="button"
              ref={botonCerrarHoja}
              className="boton secundario ancho"
              onClick={() => setElegida(null)}
            >
              Cerrar
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
