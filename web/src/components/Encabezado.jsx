import { Link } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext';
import { NOMBRE_ROL } from '../sesion/menu';

// Encabezado de las pantallas internas: sello pequeño, título, quién está en sesión y Salir.
export default function Encabezado({ titulo, volver = false }) {
  const { usuario, cerrarSesion } = useSesion();
  return (
    <header className="franja compacta">
      {volver ? (
        <Link to="/" className="sello sello-chico" aria-label="Volver al menú">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M12.5 4 6.5 10l6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      ) : (
        <div className="sello sello-chico">
          <img src="/logo-lapampa.png" alt="" />
        </div>
      )}
      <div className="franja-texto">
        <h1>{titulo}</h1>
        {usuario && (
          <p>
            {usuario.nombre} · {NOMBRE_ROL[usuario.rol]}
          </p>
        )}
      </div>
      <button type="button" className="enlace-salir" onClick={() => cerrarSesion()}>
        Salir
      </button>
    </header>
  );
}
