import { useCallback, useEffect, useState } from 'react';
import Encabezado from '../components/Encabezado';
import { useSesion } from '../sesion/SesionContext';
import { NOMBRE_ROL } from '../sesion/menu';
import { actualizarUsuario, crearUsuario, listarUsuarios, mensajeDeError } from '../services/api';

const ROLES = ['mesero', 'cajero', 'propietario'];
const VACIO = { nombre: '', usuario: '', contrasena: '', rol: 'mesero' };

// Cuentas del personal: solo el propietario entra aquí (HU01).
export default function Usuarios() {
  const { usuario: yo } = useSesion();
  const [usuarios, setUsuarios] = useState(null);
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(null);
  // null = sin formulario abierto; 'nuevo' = crear; un número = editar esa cuenta
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setUsuarios(await listarUsuarios());
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function abrirNuevo() {
    setForm(VACIO);
    setEditando('nuevo');
    setError(null);
    setExito(null);
  }

  function abrirEdicion(u) {
    setForm({ nombre: u.nombre, usuario: u.usuario, contrasena: '', rol: u.rol });
    setEditando(u.id);
    setError(null);
    setExito(null);
  }

  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(evento) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      if (editando === 'nuevo') {
        const creado = await crearUsuario(form);
        setExito(`Cuenta creada: ${creado.usuario}. Ya puede iniciar sesión.`);
      } else {
        const cambios = { nombre: form.nombre, rol: form.rol };
        if (form.contrasena) cambios.contrasena = form.contrasena;
        await actualizarUsuario(editando, cambios);
        setExito(
          form.contrasena ? 'Cambios guardados. La contraseña es nueva.' : 'Cambios guardados.',
        );
      }
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(u) {
    setError(null);
    setExito(null);
    try {
      await actualizarUsuario(u.id, { activo: !u.activo });
      setExito(
        u.activo
          ? `${u.nombre} ya no puede iniciar sesión.`
          : `${u.nombre} puede volver a iniciar sesión.`,
      );
      await cargar();
    } catch (err) {
      setError(mensajeDeError(err));
    }
  }

  return (
    <main className="pagina">
      <Encabezado titulo="Usuarios" volver />

      {editando === null && (
        <button type="button" className="boton ancho" onClick={abrirNuevo}>
          Nueva cuenta
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
        <form className="bloque formulario" onSubmit={guardar}>
          <h2 className="seccion-titulo">
            {editando === 'nuevo' ? 'Nueva cuenta' : 'Editar cuenta'}
          </h2>
          <div className="campo">
            <label htmlFor="u-nombre">Nombre</label>
            <input id="u-nombre" value={form.nombre} onChange={cambiar('nombre')} required />
          </div>
          <div className="campo">
            <label htmlFor="u-usuario">Usuario para ingresar</label>
            <input
              id="u-usuario"
              value={form.usuario}
              onChange={cambiar('usuario')}
              autoCapitalize="none"
              autoCorrect="off"
              disabled={editando !== 'nuevo'}
              required
            />
            {editando === 'nuevo' && (
              <small>Sin tildes ni espacios. Ejemplo: yesica o juan.perez</small>
            )}
          </div>
          <div className="campo">
            <label htmlFor="u-clave">
              {editando === 'nuevo' ? 'Contraseña' : 'Nueva contraseña'}
            </label>
            <input
              id="u-clave"
              type="text"
              autoComplete="new-password"
              value={form.contrasena}
              onChange={cambiar('contrasena')}
              required={editando === 'nuevo'}
            />
            <small>
              {editando === 'nuevo'
                ? 'Mínimo 8 caracteres.'
                : 'Déjala vacía para no cambiarla. Cambiarla también desbloquea la cuenta.'}
            </small>
          </div>
          <div className="campo">
            <label htmlFor="u-rol">Rol</label>
            <select
              id="u-rol"
              value={form.rol}
              onChange={cambiar('rol')}
              disabled={editando === yo.id}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
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

      {!usuarios && !error && <p className="nota">Cargando cuentas…</p>}

      {usuarios && (
        <ul className="lista-usuarios">
          {usuarios.map((u) => (
            <li key={u.id} className={`bloque usuario ${u.activo ? '' : 'inactivo'}`}>
              <div className="usuario-datos">
                <strong>{u.nombre}</strong>
                <span>
                  {u.usuario} · {NOMBRE_ROL[u.rol]}
                  {!u.activo && ' · Desactivada'}
                </span>
              </div>
              <div className="acciones">
                <button
                  type="button"
                  className="boton secundario chico"
                  onClick={() => abrirEdicion(u)}
                >
                  Editar
                </button>
                {u.id !== yo.id && (
                  <button
                    type="button"
                    className="boton secundario chico"
                    onClick={() => cambiarEstado(u)}
                  >
                    {u.activo ? 'Desactivar' : 'Activar'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
