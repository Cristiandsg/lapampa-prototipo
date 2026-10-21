import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext';
import { mensajeDeError } from '../services/api';

// Pantalla 1 de los mockups aprobados: ingreso para los tres roles.
export default function Ingreso() {
  const { usuario: sesionActiva, aviso, ingresar } = useSesion();
  const navigate = useNavigate();
  const ubicacion = useLocation();
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [lento, setLento] = useState(false);
  const [error, setError] = useState(null);
  const campoUsuario = useRef(null);

  useEffect(() => {
    campoUsuario.current?.focus();
  }, []);

  // Si el servidor gratuito está dormido, el primer ingreso tarda: se avisa para que nadie se desespere.
  useEffect(() => {
    if (!enviando) return undefined;
    const t = setTimeout(() => setLento(true), 4000);
    return () => {
      clearTimeout(t);
      setLento(false);
    };
  }, [enviando]);

  if (sesionActiva) return <Navigate to="/" replace />;

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    if (!usuario.trim() || !contrasena) {
      setError('Escribe tu usuario y tu contraseña.');
      return;
    }
    setEnviando(true);
    try {
      await ingresar(usuario, contrasena);
      navigate(ubicacion.state?.desde || '/', { replace: true });
    } catch (err) {
      setError(mensajeDeError(err));
      setContrasena('');
      setEnviando(false);
    }
  }

  const mensaje = error || aviso;

  return (
    <main className="ingreso">
      <header className="franja grande">
        <div className="sello sello-grande">
          <img src="/logo-lapampa.png" alt="Logo de La Pampa Gastro Bar" />
        </div>
        <h1>La Pampa</h1>
        <p>Del Pacífico a tu paladar</p>
      </header>

      <form className="formulario" onSubmit={enviar} noValidate>
        <h2 className="seccion-titulo">Ingresar</h2>

        {mensaje && (
          <p className="alerta" role="alert">
            {mensaje}
          </p>
        )}

        <div className="campo">
          <label htmlFor="usuario">Usuario</label>
          <input
            id="usuario"
            ref={campoUsuario}
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            disabled={enviando}
          />
        </div>

        <div className="campo">
          <label htmlFor="contrasena">Contraseña</label>
          <div className="campo-clave">
            <input
              id="contrasena"
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              disabled={enviando}
            />
            <button
              type="button"
              className="ver-clave"
              onClick={() => setVerClave((v) => !v)}
              aria-pressed={verClave}
            >
              {verClave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>

        <button type="submit" className="boton ancho" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>

        {lento && (
          <p className="nota" role="status">
            El servidor se está despertando. Puede tardar hasta un minuto la primera vez.
          </p>
        )}

        <p className="nota">
          Cada persona ve solo las opciones de su rol: mesero, cajero o propietario.
        </p>
      </form>

      <p className="nota pie">
        <Link to="/estado">Estado del sistema</Link>
      </p>
    </main>
  );
}
