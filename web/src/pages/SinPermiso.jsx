import { Link } from 'react-router-dom';
import Encabezado from '../components/Encabezado';

export default function SinPermiso() {
  return (
    <main className="pagina">
      <Encabezado titulo="Sin permiso" volver />
      <section className="bloque centrado">
        <h2 className="seccion-titulo">Esta opción no es para tu rol</h2>
        <p>Si crees que deberías poder entrar, habla con el propietario.</p>
        <Link to="/" className="boton">
          Volver al menú
        </Link>
      </section>
    </main>
  );
}
