import Franja from '../components/Franja';
import LineaCarta from '../components/LineaCarta';

const COLORES = [
  ['Mostaza', '--mostaza', '#E8B95E', 'Encabezados y fondos de bebidas'],
  ['Crema', '--crema', '#EFE6BD', 'Fondo general'],
  ['Papel', '--papel', '#FAF5E1', 'Tarjetas y campos'],
  ['Café', '--cafe', '#4A3418', 'Títulos, texto y botones'],
  ['Hoja', '--hoja', '#4E6A2E', 'Libre / confirmado'],
  ['Dorado', '--dorado', '#8A5F14', 'Ocupada / en proceso'],
  ['Achiote', '--achiote', '#A63D25', 'Por cobrar / error'],
];

// Guía viva de estilo: el equipo la consulta en /estilo mientras construye pantallas
export default function GuiaEstilo() {
  return (
    <main className="pagina">
      <Franja titulo="Guía de estilo" subtitulo="Tomada de la carta de La Pampa" />

      <section className="bloque">
        <h2 className="seccion-titulo">Pa' aguaitar</h2>
        <ul className="carta">
          <LineaCarta
            nombre="Chumblún"
            precio={23000}
            descripcion="Trozos de pescado al panko con salsas pamperas"
          />
          <LineaCarta
            nombre="Batea"
            precio={24000}
            descripcion="Anillos de calamar al panko acompañados con salsas pamperas"
          />
          <LineaCarta
            nombre="Asunto allá"
            precio={13000}
            descripcion="Maduro frito con queso costeño"
          />
        </ul>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo">Estados de mesa</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="chip libre">Libre</span>
          <span className="chip ocupada">Ocupada</span>
          <span className="chip por-cobrar">Por cobrar</span>
        </div>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo">Botones</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="boton" type="button">
            Enviar a caja
          </button>
          <button className="boton secundario" type="button">
            Nueva mesa
          </button>
        </div>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo">Colores</h2>
        <ul className="carta">
          {COLORES.map(([nombre, variable, hex, uso]) => (
            <li key={variable} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: `var(${variable})`,
                  border: '1px solid var(--linea)',
                  flex: 'none',
                }}
              />
              <span>
                <strong>{nombre}</strong> {hex}
                <small>{uso}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="bloque">
        <h2 className="seccion-titulo">Tipografías</h2>
        <p style={{ fontFamily: 'var(--titulo)', fontWeight: 900, fontSize: '1.6rem' }}>
          Playfair Display Black
        </p>
        <small className="nota" style={{ textAlign: 'left', display: 'block' }}>
          Títulos y nombres de sección
        </small>
        <p style={{ marginTop: 12, fontWeight: 500 }}>
          Montserrat — textos, precios, botones y formularios
        </p>
      </section>
    </main>
  );
}
