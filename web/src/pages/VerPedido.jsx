import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import LineaCarta, { pesos } from '../components/LineaCarta';
import { mensajeDeError, obtenerPedido } from '../services/api';

const ESTADO = {
  abierto: 'Abierto',
  por_cobrar: 'Por cobrar',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
};

function hora(fecha) {
  return new Date(fecha).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// HU04 — El pedido de una mesa: lo que se pidió, el total y la comanda que va a cocina.
// (Modificarlo es la HU05, en el Sprint 2.)
export default function VerPedido() {
  const { id } = useParams();
  const { state } = useLocation();
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPedido(id)
      .then(setPedido)
      .catch((err) => setError(mensajeDeError(err)));
  }, [id]);

  const volver = { volver: true, volverA: '/mesas', etiquetaVolver: 'Volver a mesas' };

  if (error) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" {...volver} />
        <p className="alerta" role="alert">
          {error}
        </p>
      </main>
    );
  }
  if (!pedido) {
    return (
      <main className="pagina">
        <Encabezado titulo="Pedido" {...volver} />
        <p className="nota">Cargando el pedido…</p>
      </main>
    );
  }

  return (
    <main className="pagina">
      <Encabezado
        titulo={pedido.mesa ?? 'Pedido'}
        subtitulo={`Pedido #${pedido.id} · ${hora(pedido.creado_en)} · ${pedido.mesero}`}
        {...volver}
      />

      {state?.recienEnviado && (
        <p className="aviso-ok" role="status">
          Pedido #{pedido.id} enviado a cocina. La mesa quedó ocupada.
        </p>
      )}

      <section className="bloque" aria-labelledby="titulo-detalle">
        <div className="fila-titulo">
          <h2 id="titulo-detalle" className="seccion-titulo">
            Pedido
          </h2>
          <span className="chip ocupada">{ESTADO[pedido.estado]}</span>
        </div>
        <ul className="carta">
          {pedido.items.map((i) => (
            <LineaCarta
              key={i.id}
              nombre={`${i.cantidad} × ${i.nombre}`}
              precio={i.total}
              descripcion={i.nota ? `Nota: ${i.nota}` : null}
            />
          ))}
        </ul>
        {pedido.observaciones && <p className="nota-producto">Obs.: {pedido.observaciones}</p>}
        <div className="total-pedido">
          <span>Total</span>
          <span>{pesos.format(pedido.subtotal)}</span>
        </div>
      </section>

      <details className="bloque">
        <summary>Ver la comanda de cocina</summary>
        <pre className="tirilla" aria-label="Comanda de cocina">
          {pedido.comanda}
        </pre>
        <p className="nota">Sale por la impresora de cocina cuando esté conectada al sistema.</p>
      </details>

      <Link to="/mesas" className="boton ancho">
        Volver a mesas
      </Link>
    </main>
  );
}
