import { useCallback, useEffect, useMemo, useState } from 'react';
import Franja from '../components/Franja';
import Encabezado from '../components/Encabezado';
import LineaCarta, { pesos } from '../components/LineaCarta';
import PoliticaDatos, {
  TEXTO_AUTORIZACION,
  TEXTO_AUTORIZACION_CAJERO,
} from '../components/PoliticaDatos';
import {
  buscarClientePorTelefono,
  cartaDomicilio,
  enviarDomicilio,
  mensajeDeError,
  registrarDomicilio,
} from '../services/api';

// "Chumblún" → "chumblun", para buscar sin tildes
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Mismo criterio que la API: celular 3xx o fijo 60x, 10 dígitos (acepta espacios y +57)
const limpiarTelefono = (t) => t.replace(/[\s\-().]/g, '').replace(/^\+?57(?=\d{10}$)/, '');
const telefonoValido = (t) => /^(3\d{9}|60\d{8})$/.test(limpiarTelefono(t));

const CLIENTE_VACIO = { nombre: '', telefono: '', direccion: '', barrio: '', referencia: '' };

// HU09 — Formulario web de domicilio, público (ruta /pedir, sin inicio de sesión).
// Tres pasos en la misma pantalla, pensados para el celular del cliente:
// 1. la carta por categorías con el carrito abajo;
// 2. los datos de entrega, el método de pago y la autorización de datos (Ley 1581);
// 3. la confirmación con el número de pedido y, si paga por transferencia, a dónde consignar
//    y el botón para mandar el comprobante por WhatsApp.
//
// HU10 — Con `cajero`, es la misma pantalla para el cajero (ruta /domicilios/nuevo, con
// sesión): registra los pedidos que llegan por llamada o WhatsApp. Lo primero que escribe es
// el celular, y si el cliente ya está registrado sus datos se cargan solos. La casilla dice
// que el cliente dio la autorización, y la confirmación trae la cuenta para dictársela.
export default function PedirDomicilio({ cajero = false }) {
  const [carta, setCarta] = useState(undefined); // undefined = cargando; null = error
  const [paso, setPaso] = useState('carta');
  // productoId → { cantidad, nota }
  const [lineas, setLineas] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [cliente, setCliente] = useState(CLIENTE_VACIO);
  const [metodoPago, setMetodoPago] = useState(null);
  const [observaciones, setObservaciones] = useState('');
  const [autoriza, setAutoriza] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmado, setConfirmado] = useState(null);
  // HU10: resultado de buscar el celular { estado: 'buscando' | 'encontrado' | 'nuevo' | 'error', mensaje }
  const [clienteBuscado, setClienteBuscado] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const datos = await cartaDomicilio();
      setCarta(datos);
      return datos;
    } catch (err) {
      setError(mensajeDeError(err));
      setCarta(null);
      return null;
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Al cambiar de paso, arriba de la pantalla
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [paso]);

  const productos = useMemo(() => carta?.categorias.flatMap((c) => c.productos) ?? [], [carta]);
  const cantidadDe = (pid) => lineas[pid]?.cantidad ?? 0;
  const elegidos = productos.filter((p) => cantidadDe(p.id) > 0);
  const unidades = elegidos.reduce((s, p) => s + cantidadDe(p.id), 0);
  const subtotal = elegidos.reduce((s, p) => s + p.precio * cantidadDe(p.id), 0);
  const envio = carta?.valorEnvio ?? 0;

  const grupos = useMemo(() => {
    const filtro = normalizar(busqueda.trim());
    return (carta?.categorias ?? [])
      .map((c) => ({
        ...c,
        productos: c.productos.filter((p) => !filtro || normalizar(p.nombre).includes(filtro)),
      }))
      .filter((c) => c.productos.length > 0);
  }, [carta, busqueda]);

  function cambiarCantidad(pid, delta) {
    setLineas((actual) => {
      const cantidad = Math.min(99, Math.max(0, (actual[pid]?.cantidad ?? 0) + delta));
      const copia = { ...actual };
      if (cantidad === 0) delete copia[pid];
      else copia[pid] = { nota: '', ...actual[pid], cantidad };
      return copia;
    });
  }

  const cambiarCliente = (campo) => (e) => setCliente((c) => ({ ...c, [campo]: e.target.value }));

  // El cliente ve la franja de la carta; el cajero, el encabezado de las pantallas internas
  const cabecera = (titulo, subtitulo) =>
    cajero ? (
      <Encabezado titulo="Registrar domicilio" volver subtitulo={subtitulo} />
    ) : (
      <Franja titulo={titulo} subtitulo={subtitulo} />
    );

  // HU10: al completar un celular válido se busca el cliente y, si existe, se cargan sus datos
  async function cambiarTelefono(e) {
    const telefono = e.target.value;
    setCliente((c) => ({ ...c, telefono }));
    if (!cajero) return;
    if (!telefonoValido(telefono)) {
      setClienteBuscado(null);
      return;
    }
    setClienteBuscado({ estado: 'buscando', mensaje: 'Buscando el cliente…' });
    try {
      const encontrado = await buscarClientePorTelefono(limpiarTelefono(telefono));
      setCliente({
        nombre: encontrado.nombre,
        telefono: encontrado.telefono,
        direccion: encontrado.direccion,
        barrio: encontrado.barrio ?? '',
        referencia: encontrado.referencia ?? '',
      });
      const fecha = new Date(encontrado.autorizacionFecha).toLocaleDateString('es-CO');
      const medio =
        encontrado.autorizacionMedio === 'formulario_web'
          ? 'en el formulario web'
          : 'por llamada o WhatsApp';
      setClienteBuscado({
        estado: 'encontrado',
        mensaje: `Cliente registrado: se cargaron sus datos. Autorizó el tratamiento de datos el ${fecha} ${medio}. Confirma la dirección con el cliente.`,
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setClienteBuscado({ estado: 'nuevo', mensaje: 'Cliente nuevo: escribe sus datos.' });
      } else {
        setClienteBuscado({ estado: 'error', mensaje: mensajeDeError(err) });
      }
    }
  }

  function registrarOtro() {
    setPaso('carta');
    setLineas({});
    setBusqueda('');
    setCliente(CLIENTE_VACIO);
    setMetodoPago(null);
    setObservaciones('');
    setAutoriza(false);
    setEnviando(false);
    setError(null);
    setConfirmado(null);
    setClienteBuscado(null);
  }

  const faltantes = [
    cliente.nombre.trim().length < 2 && 'tu nombre',
    !telefonoValido(cliente.telefono) && 'un celular de 10 dígitos',
    cliente.direccion.trim().length < 5 && 'la dirección',
    !metodoPago && 'cómo vas a pagar',
    !autoriza && 'la autorización de datos',
  ].filter(Boolean);

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando || faltantes.length > 0 || elegidos.length === 0) return;
    setError(null);
    setEnviando(true);
    try {
      const registrar = cajero ? registrarDomicilio : enviarDomicilio;
      const respuesta = await registrar({
        autorizaDatos: true,
        items: elegidos.map((p) => ({
          productoId: p.id,
          cantidad: cantidadDe(p.id),
          nota: lineas[p.id].nota?.trim() || null,
        })),
        cliente: {
          nombre: cliente.nombre.trim(),
          telefono: limpiarTelefono(cliente.telefono),
          direccion: cliente.direccion.trim(),
          barrio: cliente.barrio.trim() || null,
          referencia: cliente.referencia.trim() || null,
        },
        metodoPago,
        observaciones: observaciones.trim() || null,
      });
      setConfirmado(respuesta);
      setPaso('confirmado');
    } catch (err) {
      setError(mensajeDeError(err));
      setEnviando(false);
      // Si algo se agotó mientras llenaba el formulario: se actualiza la carta, se quita del
      // carrito y vuelve a la carta para que lo vea.
      if (err.response?.status === 409) {
        const nueva = await cargar();
        if (nueva) {
          const vigentes = new Set(nueva.categorias.flatMap((c) => c.productos.map((p) => p.id)));
          setLineas((actual) =>
            Object.fromEntries(Object.entries(actual).filter(([pid]) => vigentes.has(Number(pid)))),
          );
          setPaso('carta');
        }
      }
    }
  }

  if (carta === undefined) {
    return (
      <main className="pagina">
        {cabecera(undefined, 'Pide a domicilio')}
        <p className="nota" role="status">
          Cargando la carta… La primera vez puede tardar hasta un minuto.
        </p>
      </main>
    );
  }

  if (carta === null) {
    return (
      <main className="pagina">
        {cabecera(undefined, 'Pide a domicilio')}
        <section className="bloque centrado">
          <p role="alert">{error}</p>
          <button
            type="button"
            className="boton"
            onClick={() => {
              setCarta(undefined);
              setError(null);
              cargar();
            }}
          >
            Intentar de nuevo
          </button>
        </section>
      </main>
    );
  }

  if (paso === 'confirmado') {
    return (
      <Confirmacion
        pedido={confirmado}
        whatsapp={carta.whatsapp}
        cajero={cajero}
        onOtro={registrarOtro}
      />
    );
  }

  if (paso === 'datos') {
    const telefonoCampo = (
      <div className="campo">
        <label htmlFor="telefono">Celular</label>
        <input
          id="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="3001234567"
          maxLength={20}
          value={cliente.telefono}
          onChange={cambiarTelefono}
          aria-describedby="ayuda-telefono"
        />
        <small id="ayuda-telefono">
          {cajero
            ? 'Escríbelo primero: si el cliente ya pidió antes, sus datos se cargan solos.'
            : 'Te llamamos aquí si hay alguna novedad.'}
        </small>
        {clienteBuscado && (
          <p className={clienteBuscado.estado === 'encontrado' ? 'aviso-ok' : 'nota'} role="status">
            {clienteBuscado.mensaje}
          </p>
        )}
      </div>
    );
    return (
      <main className="pagina">
        {cabecera('Tus datos', cajero ? 'Datos del cliente' : 'Para llevarte el pedido')}

        <form className="formulario" onSubmit={enviar} noValidate>
          <section className="bloque" aria-labelledby="t-resumen">
            <div className="fila-titulo">
              <h2 id="t-resumen" className="seccion-titulo">
                {cajero ? 'Pedido' : 'Tu pedido'}
              </h2>
              <button
                type="button"
                className="boton secundario chico"
                onClick={() => {
                  setError(null);
                  setPaso('carta');
                }}
              >
                Cambiar
              </button>
            </div>
            <ul className="carta">
              {elegidos.map((p) => (
                <LineaCarta
                  key={p.id}
                  nombre={`${cantidadDe(p.id)} x ${p.nombre}`}
                  precio={p.precio * cantidadDe(p.id)}
                  descripcion={lineas[p.id].nota ? `Nota: ${lineas[p.id].nota}` : null}
                />
              ))}
            </ul>
            <dl className="resumen-cobro resumen-domicilio">
              <div>
                <dt>Productos</dt>
                <dd>{pesos.format(subtotal)}</dd>
              </div>
              <div>
                <dt>Envío</dt>
                <dd>{pesos.format(envio)}</dd>
              </div>
              <div className="resumen-total">
                <dt>Total</dt>
                <dd>{pesos.format(subtotal + envio)}</dd>
              </div>
            </dl>
          </section>

          <section className="bloque formulario" aria-labelledby="t-entrega">
            <h2 id="t-entrega" className="seccion-titulo">
              Entrega
            </h2>
            {cajero && telefonoCampo}
            <div className="campo">
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                autoComplete="name"
                maxLength={80}
                value={cliente.nombre}
                onChange={cambiarCliente('nombre')}
              />
            </div>
            {!cajero && telefonoCampo}
            <div className="campo">
              <label htmlFor="direccion">Dirección</label>
              <input
                id="direccion"
                autoComplete="street-address"
                placeholder="Ej.: Calle 70 # 3BN-45, apto 201"
                maxLength={150}
                value={cliente.direccion}
                onChange={cambiarCliente('direccion')}
              />
            </div>
            <div className="campo">
              <label htmlFor="barrio">Barrio (opcional)</label>
              <input
                id="barrio"
                maxLength={60}
                value={cliente.barrio}
                onChange={cambiarCliente('barrio')}
              />
            </div>
            <div className="campo">
              <label htmlFor="referencia">Referencia (opcional)</label>
              <input
                id="referencia"
                placeholder="Ej.: casa esquinera, portón negro"
                maxLength={150}
                value={cliente.referencia}
                onChange={cambiarCliente('referencia')}
              />
            </div>
            <div className="campo">
              <label htmlFor="observaciones">Observaciones (opcional)</label>
              <textarea
                id="observaciones"
                rows={2}
                maxLength={255}
                placeholder="Ej.: el timbre no sirve, llamar al llegar"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>
          </section>

          <section className="bloque" aria-labelledby="t-pago">
            <h2 id="t-pago" className="seccion-titulo">
              {cajero ? '¿Cómo va a pagar?' : '¿Cómo vas a pagar?'}
            </h2>
            <div className="opciones-propina" role="group" aria-labelledby="t-pago">
              <button
                type="button"
                className="opcion-propina"
                aria-pressed={metodoPago === 'contra_entrega'}
                onClick={() => setMetodoPago('contra_entrega')}
              >
                <strong>Contra entrega</strong>
                <span>{cajero ? 'Paga al recibir' : 'Pagas al recibir'}</span>
              </button>
              <button
                type="button"
                className="opcion-propina"
                aria-pressed={metodoPago === 'transferencia'}
                onClick={() => setMetodoPago('transferencia')}
              >
                <strong>Transferencia</strong>
                <span>{carta.transferencia.banco}</span>
              </button>
            </div>
            {metodoPago === 'transferencia' && (
              <p className="nota-pago">
                {cajero
                  ? 'Al registrarlo te mostramos la cuenta para dictársela. No pasa a cocina hasta que se confirme el pago.'
                  : 'Te mostramos la cuenta al enviar el pedido. Lo empezamos a preparar cuando nos llegue tu comprobante por WhatsApp.'}
              </p>
            )}
          </section>

          <section className="bloque" aria-labelledby="t-datos">
            <h2 id="t-datos" className="seccion-titulo">
              {cajero ? 'Datos personales del cliente' : 'Tus datos personales'}
            </h2>
            <label className="autorizacion">
              <input
                type="checkbox"
                checked={autoriza}
                onChange={(e) => setAutoriza(e.target.checked)}
              />
              <span>{cajero ? TEXTO_AUTORIZACION_CAJERO : TEXTO_AUTORIZACION}</span>
            </label>
            <details>
              <summary>Leer la política de tratamiento de datos</summary>
              <PoliticaDatos whatsapp={carta.whatsapp} />
            </details>
          </section>

          {error && (
            <p className="alerta" role="alert">
              {error}
            </p>
          )}
          {faltantes.length > 0 && (
            <p className="nota" aria-live="polite">
              Para enviar falta: {faltantes.join(', ')}.
            </p>
          )}
          <button type="submit" className="boton ancho" disabled={faltantes.length > 0 || enviando}>
            {enviando
              ? 'Enviando…'
              : `${cajero ? 'Registrar domicilio' : 'Enviar pedido'} · ${pesos.format(subtotal + envio)}`}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="pagina con-pie">
      {cabecera(undefined, cajero ? 'Pedido por llamada o WhatsApp' : 'Pide a domicilio')}

      {error && (
        <p className="alerta" role="alert">
          {error}
        </p>
      )}

      <div className="campo">
        <label htmlFor="buscar-producto">Buscar en la carta</label>
        <input
          id="buscar-producto"
          type="search"
          placeholder="Ej.: chumblún, limonada"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      {!busqueda && (
        <nav className="filtros" aria-label="Categorías de la carta">
          {grupos.map((c) => (
            <button
              key={c.id}
              type="button"
              className="filtro"
              onClick={() =>
                document
                  .getElementById(`cat-${c.id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            >
              {c.nombre}
            </button>
          ))}
        </nav>
      )}

      {grupos.length === 0 && (
        <p className="nota">
          {busqueda ? 'No hay productos con ese nombre.' : 'Hoy no hay productos disponibles.'}
        </p>
      )}

      {grupos.map((c) => (
        <section key={c.id} id={`cat-${c.id}`} className="bloque" aria-labelledby={`t-cat-${c.id}`}>
          <h2 id={`t-cat-${c.id}`} className="seccion-titulo">
            {c.nombre}
          </h2>
          <ul className="carta">
            {c.productos.map((p) => {
              const cantidad = cantidadDe(p.id);
              return (
                <LineaCarta
                  key={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  descripcion={p.descripcion}
                  className={`producto ${cantidad ? 'elegido' : ''}`}
                >
                  <div className="acciones">
                    {cantidad > 0 ? (
                      <div className="contador" role="group" aria-label={`Cantidad de ${p.nombre}`}>
                        <button
                          type="button"
                          className="boton-redondo"
                          aria-label={`Quitar uno de ${p.nombre}`}
                          onClick={() => cambiarCantidad(p.id, -1)}
                        >
                          −
                        </button>
                        <span aria-live="polite">{cantidad}</span>
                        <button
                          type="button"
                          className="boton-redondo lleno"
                          aria-label={`Agregar uno de ${p.nombre}`}
                          onClick={() => cambiarCantidad(p.id, 1)}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="boton-redondo"
                        aria-label={`Agregar ${p.nombre}`}
                        onClick={() => cambiarCantidad(p.id, 1)}
                      >
                        +
                      </button>
                    )}
                  </div>
                  {cantidad > 0 && (
                    <div className="campo">
                      <label htmlFor={`nota-${p.id}`}>Nota para {p.nombre} (opcional)</label>
                      <input
                        id={`nota-${p.id}`}
                        maxLength={120}
                        placeholder="Ej.: sin cebolla"
                        value={lineas[p.id].nota}
                        onChange={(e) =>
                          setLineas((a) => ({ ...a, [p.id]: { ...a[p.id], nota: e.target.value } }))
                        }
                      />
                    </div>
                  )}
                </LineaCarta>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="nota">Envío: {pesos.format(envio)} · Domicilios en Cali</p>

      <footer className="pie-pedido">
        <div className="pie-pedido-fila">
          <div>
            <p className="pie-cantidad">
              {unidades === 0
                ? 'Tu pedido está vacío'
                : `${unidades} ${unidades === 1 ? 'producto' : 'productos'} + envío`}
            </p>
            <p className="pie-total">{pesos.format(unidades ? subtotal + envio : 0)}</p>
          </div>
          <button
            type="button"
            className="boton"
            disabled={unidades === 0}
            onClick={() => {
              setError(null);
              setPaso('datos');
            }}
          >
            Continuar
          </button>
        </div>
      </footer>
    </main>
  );
}

// Paso 3 — El pedido ya quedó registrado
function Confirmacion({ pedido, whatsapp, cajero, onOtro }) {
  const porTransferencia = pedido.metodoPago === 'transferencia';
  const mensaje = `Hola, envío el comprobante de la transferencia del pedido #${pedido.pedidoId} por ${pesos.format(pedido.total)}.`;
  const enlaceWhatsapp = `https://wa.me/57${whatsapp}?text=${encodeURIComponent(mensaje)}`;

  return (
    <main className="pagina">
      {cajero ? (
        <Encabezado titulo="Domicilio registrado" volver />
      ) : (
        <Franja titulo="¡Pedido recibido!" subtitulo="Gracias por pedir en La Pampa" />
      )}

      <section className="bloque centrado" aria-labelledby="t-numero">
        <h2 id="t-numero" className="seccion-titulo">
          {cajero ? 'Número de pedido' : 'Tu número de pedido'}
        </h2>
        <p className="cifra-grande">#{pedido.pedidoId}</p>
        <p>Total a pagar: {pesos.format(pedido.total)}</p>
        <small className="nota">
          Incluye {pesos.format(pedido.valorEnvio)} del envío.{' '}
          {cajero ? 'Díctale este número al cliente.' : 'Guarda este número por si nos escribes.'}
        </small>
      </section>

      {porTransferencia ? (
        <section className="bloque formulario" aria-labelledby="t-transferencia">
          <h2 id="t-transferencia" className="seccion-titulo">
            {cajero ? 'Cuenta para dictarle al cliente' : 'Paga por transferencia'}
          </h2>
          <dl className="resumen-cobro">
            <div>
              <dt>Banco</dt>
              <dd>{pedido.pago.banco}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{pedido.pago.tipo}</dd>
            </div>
            <div>
              <dt>Número</dt>
              <dd>{pedido.pago.numero}</dd>
            </div>
            {pedido.pago.titular && (
              <div>
                <dt>Titular</dt>
                <dd>{pedido.pago.titular}</dd>
              </div>
            )}
            <div className="resumen-total">
              <dt>Valor</dt>
              <dd>{pesos.format(pedido.total)}</dd>
            </div>
          </dl>
          {cajero ? (
            <p className="alerta">
              Queda pendiente de pago y no pasa a cocina. Pídele al cliente el comprobante por
              WhatsApp al {whatsapp}.
            </p>
          ) : (
            <>
              <p className="alerta">
                Tu pedido queda pendiente de pago: lo empezamos a preparar cuando nos envíes el
                comprobante por WhatsApp y lo confirmemos.
              </p>
              <a className="boton ancho" href={enlaceWhatsapp} target="_blank" rel="noreferrer">
                Enviar comprobante por WhatsApp
              </a>
              <p className="nota">WhatsApp del local: {whatsapp}</p>
            </>
          )}
        </section>
      ) : (
        <p className="aviso-ok">
          {cajero
            ? `La comanda ya va para cocina. El cliente paga ${pesos.format(pedido.total)} al recibir.`
            : `Ya lo estamos preparando. Pagas ${pesos.format(pedido.total)} cuando te llegue: ten el efectivo listo o avísanos si necesitas cambio.`}
        </p>
      )}

      <section className="bloque" aria-labelledby="t-detalle">
        <h2 id="t-detalle" className="seccion-titulo">
          {cajero ? 'Lo que pidió' : 'Lo que pediste'}
        </h2>
        <ul className="carta">
          {pedido.items.map((i) => (
            <LineaCarta
              key={`${i.nombre}-${i.nota}`}
              nombre={`${i.cantidad} x ${i.nombre}`}
              precio={i.total}
              descripcion={i.nota ? `Nota: ${i.nota}` : null}
            />
          ))}
        </ul>
      </section>

      {cajero && (
        <button type="button" className="boton ancho" onClick={onOtro}>
          Registrar otro domicilio
        </button>
      )}
    </main>
  );
}
