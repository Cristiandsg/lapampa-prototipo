// Formato de la carta: $23.000
const pesos = { format: (v) => `$${Math.round(v).toLocaleString('es-CO')}` };

// Una línea de producto como en la carta impresa: "Chumblún ......... $23.000"
export default function LineaCarta({ nombre, precio, descripcion }) {
  return (
    <li>
      <div className="carta-linea">
        <span>{nombre}</span>
        <span className="relleno" aria-hidden="true" />
        <span className="precio">{pesos.format(precio)}</span>
      </div>
      {descripcion && <small>{descripcion}</small>}
    </li>
  );
}
