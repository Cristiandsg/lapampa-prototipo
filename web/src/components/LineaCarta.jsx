// Formato de la carta: $23.000
export const pesos = { format: (v) => `$${Math.round(v).toLocaleString('es-CO')}` };

// Una línea de producto como en la carta impresa: "Chumblún ......... $23.000"
// children: contenido extra debajo (estado, botones) en las pantallas de gestión.
export default function LineaCarta({ nombre, precio, descripcion, className, children }) {
  return (
    <li className={className}>
      <div className="carta-linea">
        <span>{nombre}</span>
        <span className="relleno" aria-hidden="true" />
        <span className="precio">{pesos.format(precio)}</span>
      </div>
      {descripcion && <small>{descripcion}</small>}
      {children}
    </li>
  );
}
