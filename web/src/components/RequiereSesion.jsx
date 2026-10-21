import { Navigate, useLocation } from 'react-router-dom';
import { useSesion } from '../sesion/SesionContext';
import SinPermiso from '../pages/SinPermiso';

// Protege una pantalla: sin sesión manda al ingreso; con un rol no permitido muestra el aviso.
export default function RequiereSesion({ roles, children }) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) return <Navigate to="/ingresar" replace state={{ desde: ubicacion.pathname }} />;
  if (roles && !roles.includes(usuario.rol)) return <SinPermiso />;
  return children;
}
