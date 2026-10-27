import { Link, Navigate } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import { useSesion } from '../sesion/SesionContext';
import { opcionesDe } from '../sesion/menu';

// Menú principal: cambia según el rol de quien inició sesión (HU01).
export default function Panel() {
  const { usuario } = useSesion();
  // El mesero solo trabaja con mesas: entra directo a "Mesas de hoy" (mockup aprobado).
  if (usuario.rol === 'mesero') return <Navigate to="/mesas" replace />;
  const primerNombre = usuario.nombre.split(' ')[0];
  const opciones = opcionesDe(usuario.rol);

  return (
    <main className="pagina">
      <Encabezado titulo={`Hola, ${primerNombre}`} />
      <nav aria-label="Menú principal">
        <ul className="menu">
          {opciones.map((o) => (
            <li key={o.ruta}>
              {o.disponible ? (
                <Link to={o.ruta} className="opcion">
                  <span className="opcion-titulo">{o.titulo}</span>
                  <span className="opcion-descripcion">{o.descripcion}</span>
                </Link>
              ) : (
                <div className="opcion proxima" aria-disabled="true">
                  <span className="opcion-titulo">{o.titulo}</span>
                  <span className="opcion-descripcion">{o.descripcion}</span>
                  <span className="opcion-sprint">Llega en el Sprint {o.sprint}</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
