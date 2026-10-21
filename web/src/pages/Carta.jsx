import { useState, useEffect } from 'react';
import Encabezado from '../components/Encabezado';
import LineaCarta from '../components/LineaCarta';
import { leerSesion } from '../sesion/almacen';

export default function Carta() {
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  
  // Estados para formularios
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nuevoProducto, setNuevoProducto] = useState({
    categoriaId: '',
    nombre: '',
    descripcion: '',
    precio: '',
  });

  const obtenerToken = () => {
    const sesion = leerSesion();
    return sesion?.token || null;
  };

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const token = obtenerToken();
      if (!token) return;

      const headers = { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      
      const resCat = await fetch('http://localhost:3000/api/categorias', { headers });
      if (resCat.ok) {
        const dataCat = await resCat.json();
        setCategorias(dataCat);
      }

      const resProd = await fetch('http://localhost:3000/api/productos', { headers });
      if (resProd.ok) {
        const dataProd = await resProd.json();
        setProductos(dataProd);
      }
    } catch (err) {
      console.error('Error al cargar la carta:', err);
    }
  }

  // Crear Categoría
  async function handleCrearCategoria(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;

    const token = obtenerToken();
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3000/api/categorias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nombre: nuevaCategoria }),
      });

      const data = await res.json();

      if (res.ok) {
        setNuevaCategoria('');
        await fetchData();
        alert('¡Categoría creada con éxito!');
      } else {
        alert(`Error: ${data.error || 'No se pudo crear la categoría'}`);
      }
    } catch (err) {
      console.error('Error al conectar:', err);
    }
  }

  // ELIMINAR CATEGORÍA
  async function handleEliminarCategoria(idCategoria, nombreCategoria) {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar la categoría "${nombreCategoria}"?\nNota: No debe tener productos asociados.`);
    if (!confirmar) return;

    const token = obtenerToken();
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/categorias/${idCategoria}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await fetchData();
        alert(`La categoría "${nombreCategoria}" ha sido eliminada.`);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'No se pudo eliminar la categoría'}`);
      }
    } catch (err) {
      console.error('Error al eliminar categoría:', err);
      alert('Ocurrió un error al intentar eliminar la categoría.');
    }
  }

  // Crear Producto
  async function handleCrearProducto(e) {
    e.preventDefault();
    const token = obtenerToken();
    if (!token) return;

    try {
      const res = await fetch('http://localhost:3000/api/productos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoriaId: Number(nuevoProducto.categoriaId),
          nombre: nuevoProducto.nombre,
          descripcion: nuevoProducto.descripcion,
          precio: Number(nuevoProducto.precio),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setNuevoProducto({ categoriaId: '', nombre: '', descripcion: '', precio: '' });
        await fetchData();
        alert('¡Producto creado con éxito!');
      } else {
        alert(`Error: ${data.error || 'No se pudo crear el producto'}`);
      }
    } catch (err) {
      console.error('Error al crear producto:', err);
    }
  }

  // ELIMINAR UN PRODUCTO ESPECÍFICO
  async function handleEliminarProducto(idProducto, nombreProducto) {
    const confirmar = window.confirm(`¿Estás seguro de que deseas eliminar "${nombreProducto}"?`);
    if (!confirmar) return;

    const token = obtenerToken();
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/productos/${idProducto}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await fetchData();
        alert(`El producto "${nombreProducto}" ha sido eliminado.`);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error || 'No se pudo eliminar el producto'}`);
      }
    } catch (err) {
      console.error('Error al eliminar producto:', err);
      alert('Ocurrió un error al intentar eliminar el producto.');
    }
  }

  // ALTERNAR ESTADO AGOTADO HOY
  async function handleToggleAgotado(idProducto, estadoActual) {
    const token = obtenerToken();
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:3000/api/productos/${idProducto}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ agotadoHoy: !estadoActual }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(`Error al actualizar estado: ${data.error || 'No se pudo actualizar'}`);
      }
    } catch (err) {
      console.error('Error al cambiar estado de agotado:', err);
      alert('Ocurrió un error al intentar actualizar el estado del producto.');
    }
  }

  const productosFiltrados = categoriaSeleccionada
    ? productos.filter((p) => p.categoria_id === Number(categoriaSeleccionada))
    : productos;

  return (
    <main className="pagina">
      <Encabezado titulo="Gestión de la Carta" />

      {/* 1. Formulario para Crear Categoría y Listado de Categorías Existentes */}
      <section className="seccion-formulario" style={{ marginBottom: '2rem', background: '#fff', padding: '1.5rem', borderRadius: '8px' }}>
        <h3>1. Gestión de Categorías</h3>
        <form onSubmit={handleCrearCategoria} style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Ej. Bebidas, Entradas, Carnes..."
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            required
            style={{ flex: 1, padding: '0.5rem' }}
          />
          <button type="submit" className="btn-primario" style={{ padding: '0.5rem 1rem' }}>
            Agregar Categoría
          </button>
        </form>

        {/* Lista de categorías existentes con opción de eliminar */}
        <div style={{ marginTop: '1.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem', color: '#555' }}>Categorías registradas:</h4>
          {categorias.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.9rem' }}>No hay categorías registradas.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {categorias.map((cat) => (
                <li key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', padding: '0.5rem 1rem', borderRadius: '4px' }}>
                  <span>{cat.nombre}</span>
                  <button
                    onClick={() => handleEliminarCategoria(cat.id, cat.nombre)}
                    style={{
                      backgroundColor: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      padding: '0.3rem 0.6rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85rem'
                    }}
                  >
                    Eliminar Categoría
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 2. Formulario para Crear Producto */}
      <section className="seccion-formulario" style={{ marginBottom: '2rem', background: '#fff', padding: '1.5rem', borderRadius: '8px' }}>
        <h3>2. Agregar Nuevo Producto</h3>
        <form onSubmit={handleCrearProducto} style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <label>Categoría: </label>
            <select
              value={nuevoProducto.categoriaId}
              onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoriaId: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="">
                {categorias.length === 0 ? 'No hay categorías creadas' : 'Seleccione una categoría'}
              </option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Nombre: </label>
            <input
              type="text"
              value={nuevoProducto.nombre}
              onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label>Descripción: </label>
            <input
              type="text"
              value={nuevoProducto.descripcion}
              onChange={(e) => setNuevoProducto({ ...nuevoProducto, descripcion: e.target.value })}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <div>
            <label>Precio ($): </label>
            <input
              type="number"
              value={nuevoProducto.precio}
              onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>

          <button type="submit" className="btn-primario" style={{ padding: '0.7rem' }}>
            Guardar Producto
          </button>
        </form>
      </section>

      <hr />

      {/* 3. Carta Actual, Filtro y Eliminación */}
      <section className="seccion-carta" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Carta Actual</h3>
          <div>
            <label>Filtrar por categoría: </label>
            <select
              value={categoriaSeleccionada}
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
              style={{ padding: '0.4rem' }}
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ul className="lista-carta" style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
          {productosFiltrados.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>No hay productos registrados en esta categoría.</p>
          ) : (
            productosFiltrados.map((p) => (
              <li 
                key={p.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '0.5rem',
                  opacity: p.agotado_hoy ? 0.6 : 1,
                  background: p.agotado_hoy ? '#f9f9f9' : '#fff',
                  padding: '0.5rem',
                  borderRadius: '4px'
                }}
              >
                <div style={{ flex: 1 }}>
                  <LineaCarta
                    nombre={p.nombre}
                    precio={p.precio}
                    descripcion={p.descripcion}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(p.agotado_hoy)}
                      onChange={() => handleToggleAgotado(p.id, Boolean(p.agotado_hoy))}
                    />
                    Agotado hoy
                  </label>

                  <button
                    onClick={() => handleEliminarProducto(p.id, p.nombre)}
                    style={{
                      backgroundColor: '#e74c3c',
                      color: '#fff',
                      border: 'none',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </main>
  );
}