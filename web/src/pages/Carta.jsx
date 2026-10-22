import { useCallback, useEffect, useMemo, useState } from 'react';
import Encabezado from '../components/Encabezado';
import LineaCarta from '../components/LineaCarta';
import {
  actualizarCategoria,
  actualizarProducto,
  crearCategoria,
  crearProducto,
  eliminarCategoria,
  listarCategorias,
  listarProductos,
  mensajeDeError,
} from '../services/api';

const PRODUCTO_VACIO = { categoriaId: '', nombre: '', descripcion: '', precio: '' };

// "23.000" o "$23000" → 23000
const soloNumero = (texto) => Number(String(texto).replace(/\D/g, ''));

// HU02 — Gestión de la carta digital (propietario).
// Los productos no se borran: se desactivan. "Agotado hoy" los oculta de los pedidos
// de la jornada sin desactivarlos.
export default function Carta() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  // null = sin formulario; 'nuevo' = crear; un número = editar ese producto
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(PRODUCTO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [cats, prods] = await Promise.all([listarCategorias(), listarProductos()]);
      setCategorias(cats);
      setProductos(prods);
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function avisar(mensaje) {
    setError(null);
    setExito(mensaje);
  }

  // Ejecuta una acción, muestra el resultado y recarga la carta
  async function hacer(accion, mensajeOk) {
    setError(null);
    setExito(null);
    try {
      await accion();
      avisar(mensajeOk);
      await cargar();
      return true;
    } catch (err) {
      setError(mensajeDeError(err));
      return false;
    }
  }

  // ---------- Productos ----------
  function abrirNuevo() {
    setForm({ ...PRODUCTO_VACIO, categoriaId: filtro || '' });
    setEditando('nuevo');
    setError(null);
    setExito(null);
  }

  function abrirEdicion(p) {
    setForm({
      categoriaId: String(p.categoria_id),
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: String(p.precio),
    });
    setEditando(p.id);
    setError(null);
    setExito(null);
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
  }

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardarProducto(evento) {
    evento.preventDefault();
    const datos = {
      categoriaId: Number(form.categoriaId),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      precio: soloNumero(form.precio),
    };
    if (!datos.categoriaId) return setError('Selecciona la categoría.');
    if (!(datos.precio > 0)) return setError('El precio debe ser mayor a cero.');

    setGuardando(true);
    const ok = await hacer(
      () => (editando === 'nuevo' ? crearProducto(datos) : actualizarProducto(editando, datos)),
      editando === 'nuevo'
        ? `${datos.nombre} quedó en la carta.`
        : `${datos.nombre} actualizado. Los pedidos anteriores conservan su precio.`,
    );
    setGuardando(false);
    if (ok) setEditando(null);
  }

  const alternarAgotado = (p) =>
    hacer(
      () => actualizarProducto(p.id, { agotadoHoy: !p.agotado_hoy }),
      p.agotado_hoy
        ? `${p.nombre} vuelve a estar disponible hoy.`
        : `${p.nombre} quedó agotado por hoy.`,
    );

  const alternarActivo = (p) =>
    hacer(
      () => actualizarProducto(p.id, { activo: !p.activo }),
      p.activo
        ? `${p.nombre} se desactivó: ya no aparece en los pedidos nuevos.`
        : `${p.nombre} volvió a la carta.`,
    );

  // ---------- Categorías ----------
  async function agregarCategoria(evento) {
    evento.preventDefault();
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    const orden = Math.max(0, ...categorias.map((c) => c.orden)) + 1;
    if (await hacer(() => crearCategoria({ nombre, orden }), `Categoría "${nombre}" creada.`)) {
      setNuevaCategoria('');
    }
  }

  const alternarCategoria = (c) =>
    hacer(
      () => actualizarCategoria(c.id, { activa: !c.activa }),
      c.activa
        ? `"${c.nombre}" quedó oculta: sus productos no salen en los pedidos.`
        : `"${c.nombre}" se muestra otra vez.`,
    );

  function borrarCategoria(c) {
    if (!window.confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    hacer(() => eliminarCategoria(c.id), `Categoría "${c.nombre}" eliminada.`);
  }

  // ---------- Vista ----------
  const grupos = useMemo(() => {
    if (!productos) return [];
    return categorias
      .filter((c) => !filtro || c.id === Number(filtro))
      .map((c) => ({ ...c, productos: productos.filter((p) => p.categoria_id === c.id) }))
      .filter((c) => c.productos.length > 0 || filtro);
  }, [categorias, productos, filtro]);

  const cantidadPorCategoria = (id) => productos?.filter((p) => p.categoria_id === id).length ?? 0;

  return (
    <main className="pagina">
      <Encabezado titulo="Carta" volver />

      {editando === null && (
        <button type="button" className="boton ancho" onClick={abrirNuevo}>
          Nuevo producto
        </button>
      )}

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}
      {exito && (
        <p className="aviso-ok" role="status">
          {exito}
        </p>
      )}

      {editando !== null && (
        <form className="bloque formulario" onSubmit={guardarProducto} noValidate>
          <h2 className="seccion-titulo">
            {editando === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
          </h2>
          <div className="campo">
            <label htmlFor="p-categoria">Categoría</label>
            <select id="p-categoria" value={form.categoriaId} onChange={cambiar('categoriaId')}>
              <option value="">Selecciona…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="p-nombre">Nombre</label>
            <input id="p-nombre" value={form.nombre} onChange={cambiar('nombre')} />
          </div>
          <div className="campo">
            <label htmlFor="p-descripcion">Descripción (opcional)</label>
            <input id="p-descripcion" value={form.descripcion} onChange={cambiar('descripcion')} />
          </div>
          <div className="campo">
            <label htmlFor="p-precio">Precio</label>
            <input
              id="p-precio"
              inputMode="numeric"
              placeholder="23000"
              value={form.precio}
              onChange={cambiar('precio')}
            />
            {editando !== 'nuevo' && (
              <small>Un precio nuevo aplica solo a los pedidos que se tomen desde ahora.</small>
            )}
          </div>
          <div className="acciones">
            <button type="button" className="boton secundario" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="boton" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="campo">
        <label htmlFor="filtro-categoria">Ver categoría</label>
        <select id="filtro-categoria" value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">Toda la carta</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      {!productos && !error && <p className="nota">Cargando la carta…</p>}

      {grupos.map((c) => (
        <section key={c.id} className="bloque" aria-labelledby={`cat-${c.id}`}>
          <h2 id={`cat-${c.id}`} className="seccion-titulo">
            {c.nombre}
          </h2>
          {!c.activa && <p className="nota">Categoría oculta: no sale en los pedidos.</p>}
          {c.productos.length === 0 ? (
            <p className="nota">Todavía no hay productos en esta categoría.</p>
          ) : (
            <ul className="carta">
              {c.productos.map((p) => (
                <LineaCarta
                  key={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  descripcion={p.descripcion}
                  className={`producto ${p.activo ? '' : 'inactivo'}`}
                >
                  {(!p.activo || p.agotado_hoy) && (
                    <span className={`chip ${p.activo ? 'ocupada' : 'por-cobrar'}`}>
                      {p.activo ? 'Agotado hoy' : 'Desactivado'}
                    </span>
                  )}
                  <div className="acciones">
                    {p.activo && (
                      <button
                        type="button"
                        className="boton secundario chico"
                        aria-pressed={p.agotado_hoy}
                        aria-label={`Agotado hoy: ${p.nombre}`}
                        onClick={() => alternarAgotado(p)}
                      >
                        Agotado hoy
                      </button>
                    )}
                    <button
                      type="button"
                      className="boton secundario chico"
                      aria-label={`Editar ${p.nombre}`}
                      onClick={() => abrirEdicion(p)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="boton secundario chico"
                      aria-label={`${p.activo ? 'Desactivar' : 'Activar'} ${p.nombre}`}
                      onClick={() => alternarActivo(p)}
                    >
                      {p.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </LineaCarta>
              ))}
            </ul>
          )}
        </section>
      ))}

      <details className="bloque categorias">
        <summary>Categorías de la carta</summary>
        <form className="fila-formulario" onSubmit={agregarCategoria}>
          <div className="campo">
            <label htmlFor="nueva-categoria">Nueva categoría</label>
            <input
              id="nueva-categoria"
              placeholder="Ej.: Postres"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
            />
          </div>
          <button type="submit" className="boton">
            Agregar
          </button>
        </form>
        <ul className="lista-categorias">
          {categorias.map((c) => {
            const cantidad = cantidadPorCategoria(c.id);
            return (
              <li key={c.id} className={c.activa ? '' : 'inactivo'}>
                <span>
                  <strong>{c.nombre}</strong>
                  <small>
                    {cantidad} {cantidad === 1 ? 'producto' : 'productos'}
                    {!c.activa && ' · oculta'}
                  </small>
                </span>
                <div className="acciones">
                  <button
                    type="button"
                    className="boton secundario chico"
                    onClick={() => alternarCategoria(c)}
                  >
                    {c.activa ? 'Ocultar' : 'Mostrar'}
                  </button>
                  {cantidad === 0 && (
                    <button
                      type="button"
                      className="boton secundario chico"
                      onClick={() => borrarCategoria(c)}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </details>
    </main>
  );
}
