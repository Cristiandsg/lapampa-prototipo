import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Encabezado from '../components/Encabezado';
import LineaCarta, { pesos } from '../components/LineaCarta';
import { cobrarPedido, mensajeDeError, obtenerPedido } from '../services/api';

const MEDIOS = [
  { medio: 'efectivo', texto: 'Efectivo', todo: 'Todo en efectivo' },
  { medio: 'tarjeta', texto: 'Tarjeta', todo: 'Todo con tarjeta' },
  { medio: 'transferencia', texto: 'Transferencia', todo: 'Todo por transferencia' },
];

// Los valores se escriben solo con números y se muestran como en la carta: 50.000
const soloNumeros = (texto) =>
  texto
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 8);
const valorDe = (texto) => Number(texto || 0);
const conPuntos = (texto) => (texto ? Number(texto).toLocaleString('es-CO') : '');

function CampoPesos({ id, etiqueta, valor, onChange, placeholder = '0' }) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <div className="campo-pesos">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={conPuntos(valor)}
          onChange={(e) => onChange(soloNumeros(e.target.value))}
        />
      </div>
    </div>
  );
}

// HU07 + HU08 — Cobrar una cuenta.
// 1. Propina (HU08): el cajero le pregunta al cliente y marca su respuesta. Nunca se suma sola.
// 2. Pago (HU07): uno o varios medios; el botón se activa solo cuando la suma cuadra con el
//    consumo más la propina. En efectivo calcula las vueltas.
export default function Cobrar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [pedido, setPedido] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [error, setError] = useState(null);
  const [respuesta, setRespuesta] = useState(null); // 'aceptada' | 'modificada' | 'rechazada'
  const [otraPropina, setOtraPropina] = useState('');
  const [pagos, setPagos] = useState({ efectivo: '', tarjeta: '', transferencia: '' });
  const [referencia, setReferencia] = useState('');
  const [recibido, setRecibido] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    obtenerPedido(id)
      .then(setPedido)
      .catch((err) => setErrorCarga(mensajeDeError(err)));
  }, [id]);

  const volver = { volver: true, volverA: '/caja', etiquetaVolver: 'Volver a caja' };

  if (errorCarga || !pedido) {
    return (
      <main className="pagina">
        <Encabezado titulo="Cobrar" {...volver} />
        {errorCarga ? (
          <p className="alerta" role="alert">
            {errorCarga}
          </p>
        ) : (
          <p className="nota">Cargando la cuenta…</p>
        )}
      </main>
    );
  }

  if (pedido.estado !== 'por_cobrar') {
    return (
      <main className="pagina">
        <Encabezado titulo={pedido.mesa ?? 'Cobrar'} {...volver} />
        <section className="bloque centrado">
          <p>
            {pedido.estado === 'pagado'
              ? `El pedido #${pedido.id} ya fue pagado.`
              : `El pedido #${pedido.id} no tiene la cuenta generada: todavía no se puede cobrar.`}
          </p>
          <Link to={`/pedidos/${pedido.id}`} className="boton">
            Ver el pedido
          </Link>
        </section>
      </main>
    );
  }

  const consumo = pedido.subtotal;
  const sugerida = pedido.propina_sugerida;
  let propina = 0;
  if (respuesta === 'aceptada') propina = sugerida;
  if (respuesta === 'modificada') propina = valorDe(otraPropina);
  const propinaLista =
    respuesta === 'aceptada' ||
    respuesta === 'rechazada' ||
    (respuesta === 'modificada' && propina > 0 && propina <= consumo);
  const total = consumo + propina;

  const pagado = MEDIOS.reduce((s, m) => s + valorDe(pagos[m.medio]), 0);
  const diferencia = total - pagado;
  const efectivo = valorDe(pagos.efectivo);
  const vueltas = valorDe(recibido) - efectivo;
  const listo = propinaLista && pagado > 0 && diferencia === 0 && !enviando;

  function todoEn(medio) {
    setPagos({ efectivo: '', tarjeta: '', transferencia: '', [medio]: String(total) });
  }

  async function registrar(evento) {
    evento.preventDefault();
    if (!listo) return;
    setError(null);
    setEnviando(true);
    try {
      const cobrado = await cobrarPedido(pedido.id, {
        propina:
          respuesta === 'modificada' ? { respuesta, valor: propina } : { respuesta, valor: null },
        pagos: MEDIOS.filter((m) => valorDe(pagos[m.medio]) > 0).map((m) => ({
          medio: m.medio,
          valor: valorDe(pagos[m.medio]),
          referencia: m.medio === 'transferencia' ? referencia.trim() || null : null,
        })),
      });
      const mesa = cobrado.mesa ? ` La mesa «${cobrado.mesa}» quedó libre.` : '';
      navigate('/caja', {
        state: {
          aviso: `Pedido #${cobrado.id} cobrado: ${pesos.format(cobrado.subtotal + (cobrado.propina?.valor ?? 0))}.${mesa}`,
        },
      });
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
    }
  }

  return (
    <main className="pagina con-pie">
      <Encabezado
        titulo={pedido.mesa ?? 'Domicilio'}
        subtitulo={`Cobrar pedido #${pedido.id} · Atendió ${pedido.mesero}`}
        {...volver}
      />

      <form className="cobro" onSubmit={registrar} noValidate>
        <section className="bloque" aria-labelledby="titulo-consumo">
          <h2 id="titulo-consumo" className="seccion-titulo">
            Consumo
          </h2>
          <ul className="carta">
            {pedido.items.map((i) => (
              <LineaCarta key={i.id} nombre={`${i.cantidad} × ${i.nombre}`} precio={i.total} />
            ))}
          </ul>
          <div className="total-pedido">
            <span>Consumo</span>
            <span>{pesos.format(consumo)}</span>
          </div>
        </section>

        <section className="bloque" aria-labelledby="titulo-propina">
          <h2 id="titulo-propina" className="seccion-titulo">
            Propina
          </h2>
          <p className="nota">
            Es voluntaria. Pregúntale al cliente y marca lo que diga: el sistema no la suma sola.
          </p>
          <div className="opciones-propina" role="group" aria-label="Respuesta del cliente">
            <button
              type="button"
              className="opcion-propina"
              aria-pressed={respuesta === 'aceptada'}
              onClick={() => setRespuesta('aceptada')}
            >
              <strong>Acepta la sugerida</strong>
              <span>10 % · {pesos.format(sugerida)}</span>
            </button>
            <button
              type="button"
              className="opcion-propina"
              aria-pressed={respuesta === 'modificada'}
              onClick={() => setRespuesta('modificada')}
            >
              <strong>Otro valor</strong>
              <span>El cliente dice cuánto</span>
            </button>
            <button
              type="button"
              className="opcion-propina"
              aria-pressed={respuesta === 'rechazada'}
              onClick={() => setRespuesta('rechazada')}
            >
              <strong>No deja propina</strong>
              <span>$0</span>
            </button>
          </div>
          {respuesta === 'modificada' && (
            <>
              <CampoPesos
                id="otra-propina"
                etiqueta="¿Cuánto deja de propina?"
                valor={otraPropina}
                onChange={setOtraPropina}
              />
              {propina > consumo && (
                <p className="alerta">La propina no puede ser mayor que el consumo.</p>
              )}
            </>
          )}
        </section>

        <section className="bloque" aria-labelledby="titulo-total">
          <h2 id="titulo-total" className="seccion-titulo">
            Total a cobrar
          </h2>
          <dl className="resumen-cobro">
            <div>
              <dt>Consumo</dt>
              <dd>{pesos.format(consumo)}</dd>
            </div>
            <div>
              <dt>Propina</dt>
              <dd>{respuesta ? pesos.format(propina) : 'Falta preguntar'}</dd>
            </div>
            <div className="resumen-total">
              <dt>Total</dt>
              <dd>{propinaLista ? pesos.format(total) : '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="bloque" aria-labelledby="titulo-pago">
          <h2 id="titulo-pago" className="seccion-titulo">
            Pago
          </h2>
          {!propinaLista ? (
            <p className="nota">Primero marca la respuesta del cliente sobre la propina.</p>
          ) : (
            <div className="pago-campos">
              <div className="chips-motivo" role="group" aria-label="Pagar todo con un medio">
                {MEDIOS.map((m) => (
                  <button
                    key={m.medio}
                    type="button"
                    className="filtro"
                    onClick={() => todoEn(m.medio)}
                  >
                    {m.todo}
                  </button>
                ))}
              </div>

              {MEDIOS.map((m) => (
                <div key={m.medio}>
                  <CampoPesos
                    id={`pago-${m.medio}`}
                    etiqueta={m.texto}
                    valor={pagos[m.medio]}
                    onChange={(v) => setPagos((p) => ({ ...p, [m.medio]: v }))}
                  />
                  {m.medio === 'efectivo' && efectivo > 0 && (
                    <div className="vueltas">
                      <CampoPesos
                        id="efectivo-recibido"
                        etiqueta="¿Con cuánto paga? (para las vueltas)"
                        valor={recibido}
                        onChange={setRecibido}
                        placeholder={efectivo.toLocaleString('es-CO')}
                      />
                      {valorDe(recibido) > 0 && (
                        <p className={vueltas >= 0 ? 'vueltas-valor' : 'alerta'} aria-live="polite">
                          {vueltas >= 0
                            ? `Vueltas: ${pesos.format(vueltas)}`
                            : `Faltan ${pesos.format(-vueltas)} en efectivo`}
                        </p>
                      )}
                    </div>
                  )}
                  {m.medio === 'transferencia' && valorDe(pagos.transferencia) > 0 && (
                    <div className="campo">
                      <label htmlFor="referencia">Referencia de la transferencia (opcional)</label>
                      <input
                        id="referencia"
                        maxLength={60}
                        placeholder="Ej.: Nequi 3001234567"
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <footer className="pie-pedido">
          {error && (
            <p className="alerta" role="alert">
              {error}
            </p>
          )}
          <div className="pie-pedido-fila">
            <div aria-live="polite">
              <p className="pie-cantidad">
                {!propinaLista
                  ? 'Falta la propina'
                  : diferencia === 0
                    ? 'Los pagos cuadran'
                    : diferencia > 0
                      ? `Faltan ${pesos.format(diferencia)}`
                      : `Sobran ${pesos.format(-diferencia)}`}
              </p>
              <p className="pie-total">{propinaLista ? pesos.format(total) : '—'}</p>
            </div>
            <button type="submit" className="boton" disabled={!listo}>
              {enviando ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        </footer>
      </form>
    </main>
  );
}
