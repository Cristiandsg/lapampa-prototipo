import { useEffect, useState } from 'react';
import { obtenerSalud } from '../services/api';

const SPRINTS = [
  { nombre: 'Sprint 1', modulo: 'Acceso, carta, mesas y pedidos' },
  { nombre: 'Sprint 2', modulo: 'Caja y control de ventas' },
  { nombre: 'Sprint 3', modulo: 'Domicilios y estado de mesas' },
  { nombre: 'Sprint 4', modulo: 'Reportes financieros' },
];

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
      <header className="encabezado">
        <p className="sobretitulo">Primer prototipo</p>
        <h1>La Pampa Gastrobar</h1>
      </header>

      <section className="tarjeta" aria-live="polite">
        <h2>Estado del sistema</h2>
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

      <section className="tarjeta">
        <h2>Próximos módulos</h2>
        <ol className="sprints">
          {SPRINTS.map((s) => (
            <li key={s.nombre}>
              <strong>{s.nombre}</strong>
              <span>{s.modulo}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
