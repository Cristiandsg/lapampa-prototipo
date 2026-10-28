import { useEffect, useRef } from 'react';

// Hoja inferior (bottom sheet) para confirmar acciones en el celular.
// Se cierra con Escape, con "Cancelar" o tocando el fondo; al abrir, el foco va a "Cancelar".
// children: el contenido; acciones: los botones principales (van antes de "Cancelar").
export default function Hoja({ titulo, extra, onCerrar, children, acciones, etiquetaCerrar }) {
  const botonCerrar = useRef(null);

  useEffect(() => {
    botonCerrar.current?.focus();
    const alTeclear = (e) => e.key === 'Escape' && onCerrar();
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return (
    <div className="fondo-hoja" onClick={onCerrar}>
      <section
        className="hoja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-hoja-comun"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hoja-cabeza">
          <h2 id="titulo-hoja-comun">{titulo}</h2>
          {extra}
        </div>
        {children}
        {acciones}
        <button
          type="button"
          ref={botonCerrar}
          className="boton secundario ancho"
          onClick={onCerrar}
        >
          {etiquetaCerrar ?? 'Cancelar'}
        </button>
      </section>
    </div>
  );
}
