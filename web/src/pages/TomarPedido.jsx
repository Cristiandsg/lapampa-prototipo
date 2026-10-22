import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import LineaCarta, { pesos } from '../components/LineaCarta';
import { useSesion } from '../sesion/SesionContext';
import {
  crearPedido,
  listarCategorias,
  listarMesas,
  listarProductos,
  mensajeDeError,
} from '../services/api';

// "Mesa" → "mesa" sin tildes, para buscar "chumblun" y encontrar "Chumblún"
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// HU04 — Tomar el pedido de una mesa libre (pantalla 3 de los mockups aprobados).
// Solo se muestra lo que se puede pedir hoy: productos activos y no agotados.
export default function TomarPedido() {
  const { id } = useParams();
  const mesaId = Number(id);
  const navigate = useNavigate();
  const { usuario } = useSesion();

  const [mesa, setMesa] = useState(undefined); // undefined = cargando; null = no existe
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  // productoId → { cantidad, nota }
  const [lineas, setLineas] = useState({});
  const [notaAbierta, setNotaAbierta] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const cargarCarta = useCallback(async () => {
    const [cats, prods] = await Promise.all([
      listarCategorias(),
      listarProductos({ disponibles: true }),
    ]);
    setCategorias(cats.filter((c) => c.activa));
    setProductos(prods);
    return prods;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [mesas] = await Promise.all([listarMesas(), cargarCarta()]);
        setMesa(mesas.find((m) => m.id === mesaId) ?? null);
      } catch (err) {
        setError(mensajeDeError(err));
        setMesa(null);
      }
    })();
  }, [mesaId, cargarCarta]);

  const cantidadDe = (pid) => lineas[pid]?.cantidad ?? 0;

  function cambiarCantidad(pid, delta) {
    setLineas((actual) => {
      const cantidad = Math.min(99, Math.max(0, (actual[pid]?.cantidad ?? 0) + delta));
      const copia = { ...actual };
      if (cantidad === 0) delete copia[pid];
      else copia[pid] = { nota: '', ...actual[pid], cantidad };
      return copia;
    });
  }

  function cambiarNota(pid, nota) {
    setLineas((actual) => ({ ...actual, [pid]: { ...actual[pid], nota } }));
  }

  const elegidos = productos.filter((p) => cantidadDe(p.id) > 0);
  const totalUnidades = elegidos.reduce((s, p) => s + cantidadDe(p.id), 0);
  const total = elegidos.reduce((s, p) => s + p.precio * cantidadDe(p.id), 0);

  const grupos = useMemo(() => {
    const filtro = normalizar(busqueda.trim());
    return categorias
      .map((c) => ({
        ...c,
        productos: productos.filter(
          (p) => p.categoria_id === c.id && (!filtro || normalizar(p.nombre).includes(filtro)),
        ),
      }))
      .filter((c) => c.productos.length > 0);
  }, [categorias, productos, busqueda]);

  function irACategoria(cid) {
    document.getElementById(`cat-${cid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function enviar() {
    if (enviando || elegidos.length === 0) return;
    setError(null);
    setEnviando(true);
    try {
      const pedido = await crearPedido({
        mesaId,
        items: elegidos.map((p) => ({
          productoId: p.id,
          cantidad: cantidadDe(p.id),
          nota: lineas[p.id].nota?.trim() || null,
        })),
        observaciones: observaciones.trim() || null,
      });
      navigate(`/pedidos/${pedido.id}`, { replace: true, state: { recienEnviado: true } });
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
      // Si algo se agotó mientras tanto, se actualiza la carta y se quita del pedido
      if (err.response?.status === 409) {
        const vigentes = new Set((await cargarCarta()).map((p) => p.id));
        setLineas((actual) =>
          Object.fromEntries(Object.entries(actual).filter(([pid]) => vigentes.has(Number(pid)))),
        );
      }
    }
  }

  if (mesa === undefined) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" volver volverA="/mesas" etiquetaVolver="Volver a mesas" />
        <p className="nota">Cargando la carta…</p>
      </main>
    );
  }

  if (mesa === null || mesa.pedido) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" volver volverA="/mesas" etiquetaVolver="Volver a mesas" />
        <section className="bloque centrado">
          <p>
            {error ||
              (mesa
                ? `La mesa "${mesa.nombre}" ya tiene un pedido abierto.`
                : 'La mesa no existe o ya fue eliminada.')}
          </p>
          {mesa?.pedido ? (
            <Link to={`/pedidos/${mesa.pedido.id}`} className="boton">
              Ver el pedido
            </Link>
          ) : (
            <Link to="/mesas" className="boton">
              Volver a mesas
            </Link>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="pagina con-pie">
      <Encabezado
        titulo={mesa.nombre}
        subtitulo={`Pedido nuevo · ${usuario.nombre}`}
        volver
        volverA="/mesas"
        etiquetaVolver="Volver a mesas"
      />

      <div className="campo">
        <label htmlFor="buscar-producto">Buscar en la carta</label>
        <input
          id="buscar-producto"
          type="search"
          placeholder="Ej.: chumblún, limonada"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {!busqueda && (
        <nav className="filtros" aria-label="Categorías de la carta">
          {grupos.map((c) => (
            <button key={c.id} type="button" className="filtro" onClick={() => irACategoria(c.id)}>
              {c.nombre}
            </button>
          ))}
        </nav>
      )}

      {grupos.length === 0 && <p className="nota">No hay productos con ese nombre.</p>}

      {grupos.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="bloque" aria-labelledby={`t-cat-${c.id}`}>
          <h2 id={`t-cat-${c.id}`} className="seccion-titulo">
            {c.nombre}
          </h2>
          <ul className="carta">
            {c.productos.map((p) => {
              const cantidad = cantidadDe(p.id);
              return (
                <LineaCarta
                  key={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  descripcion={p.descripcion}
                  className={`producto ${cantidad ? 'elegido' : ''}`}
                >
                  <div className="acciones">
                    {cantidad > 0 && (
                      <button
                        type="button"
                        className="boton secundario chico"
                        aria-expanded={notaAbierta === p.id}
                        onClick={() => setNotaAbierta(notaAbierta === p.id ? null : p.id)}
                      >
                        {lineas[p.id]?.nota ? 'Editar nota' : 'Nota'}
                      </button>
                    )}
                    {cantidad > 0 ? (
                      <div className="contador" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                        <button
                          type="button"
                          className="boton-redondo"
                          aria-label={`Quitar uno de ${p.nombre}`}
                          onClick={() => cambiarCantidad(p.id, -1)}
                        >
                          −
                        </button>
                        <span aria-live="polite">{cantidad}</span>
                        <button
                          type="button"
                          className="boton-redondo lleno"
                          aria-label={`Agregar uno de ${p.nombre}`}
                          onClick={() => cambiarCantidad(p.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="boton-redondo"
                        aria-label={`Agregar ${p.nombre}`}
                        onClick={() => cambiarCantidad(p.id, 1)}
                      >
                        +
                      </button>
                    )}
                  </div>
                  {cantidad > 0 && lineas[p.id]?.nota && notaAbierta !== p.id && (
                    <p className="nota-producto">Nota: {lineas[p.id].nota}</p>
                  )}
                  {cantidad > 0 && notaAbierta === p.id && (
                    <div className="campo">
                      <label htmlFor={`nota-${p.id}`}>Nota para {p.nombre}</label>
                      <input
                        id={`nota-${p.id}`}
                        maxLength={120}
                        placeholder="Ej.: sin cebolla, término medio"
                        value={lineas[p.id].nota}
                        onChange={(e) => cambiarNota(p.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && setNotaAbierta(null)}
                      />
                    </div>
                  )}
                </LineaCarta>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="campo">
        <label htmlFor="observaciones">Observaciones del pedido (opcional)</label>
        <textarea
          id="observaciones"
          rows={2}
          maxLength={255}
          placeholder="Ej.: es un cumpleaños, traer todo junto"
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />
      </div>

      <footer className="pie-pedido">
        {error && (
          <p className="alerta" role="alert">
            {error}
          </p>
        )}
        <div className="pie-pedido-fila">
          <div>
            <p className="pie-cantidad">
              {totalUnidades === 0
                ? 'Sin productos'
                : `${totalUnidades} ${totalUnidades === 1 ? 'producto' : 'productos'}`}
            </p>
            <p className="pie-total">{pesos.format(total)}</p>
          </div>
          <button
            type="button"
            className="boton"
            disabled={elegidos.length === 0 || enviando}
            onClick={enviar}
          >
            {enviando ? 'Enviando…' : 'Enviar a cocina'}
          </button>
        </div>
      </footer>
    </main>
  );
}
