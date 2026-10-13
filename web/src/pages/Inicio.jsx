import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerSalud } from '../services/api';
import Franja from '../components/Franja';

export default function Inicio() {
  const [salud, setSalud] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    obtenerSalud()
      .then(setSalud)
      .catch(() => setError(true));
  }, []);

  const apiOk = salud?.estado === 'ok';
  const bdOk = salud?.baseDeDatos === 'conectada';

  return (
    <main className="pagina">
      <Franja subtitulo="Sistema de pedidos, ventas y domicilios" />

      <section className="bloque" aria-live="polite">
        <h2 className="seccion-titulo">Estado del sistema</h2>
        <ul className="estado">
          <li>
            <span className={`punto ${error ? 'mal' : apiOk ? 'bien' : 'espera'}`} />
            API {error ? 'sin respuesta' : apiOk ? 'funcionando' : 'consultando…'}
          </li>
          <li>
            <span className={`punto ${!salud ? 'espera' : bdOk ? 'bien' : 'mal'}`} />
            Base de datos {!salud ? '—' : salud.baseDeDatos}
          </li>
        </ul>
      </section>

      <p className="nota">
        Primer prototipo · Sprint 0 · <Link to="/estilo">Ver guía de estilo</Link>
      </p>
    </main>
  );
}
