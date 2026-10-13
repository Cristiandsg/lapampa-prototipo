// Encabezado con el sello de La Pampa, igual que la portada de la carta
export default function Franja({ titulo = 'La Pampa', subtitulo = 'Del Pacífico a tu paladar' }) {
  return (
    <header className="franja">
      <div className="sello">
        <img src="/logo-lapampa.png" alt="Logo de La Pampa Gastro Bar" />
      </div>
      <div>
        <h1>{titulo}</h1>
        <p>{subtitulo}</p>
      </div>
    </header>
  );
}
