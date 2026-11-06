// HU16 — El ciclo del agente: cada pocos segundos pide a la API lo que falta por imprimir
// en cada impresora, lo imprime en orden y confirma cada tirilla.
//
// Reglas para que nada se pierda ni salga dos veces:
// - Un trabajo solo se marca 'impreso' después de que la impresora lo recibió.
// - Si la impresora falla, se reporta el error, ese trabajo queda en la cola y no se
//   imprime nada más de esa impresora hasta reintentar (así no se desordenan las comandas).
//   La otra impresora sigue funcionando.
// - Si la tirilla salió pero la confirmación no llegó a la API (internet caído), el id se
//   guarda en `sinConfirmar` (y en disco) y NO se vuelve a imprimir: solo se reintenta
//   la confirmación.
// - Un ciclo no empieza mientras el anterior sigue corriendo.
const fs = require('fs');

function crearAgente({
  api,
  impresoras, // { cocina: destino, caja: destino }
  imprimir, // (destino, trabajo) => Promise
  archivoEstado = null, // dónde recordar las tirillas impresas sin confirmar
  esperaTrasErrorMs = 15000,
  ahora = Date.now,
  registro = console,
}) {
  const sinConfirmar = new Set(leerEstado(archivoEstado));
  const pausaHasta = {};
  let ocupado = false;

  function guardarEstado() {
    if (!archivoEstado) return;
    try {
      fs.writeFileSync(archivoEstado, JSON.stringify([...sinConfirmar]));
    } catch (err) {
      registro.error(`No se pudo guardar ${archivoEstado}: ${err.message}`);
    }
  }

  async function confirmar(id) {
    try {
      await api.marcarImpreso(id);
      if (sinConfirmar.delete(id)) guardarEstado();
      return true;
    } catch (err) {
      if (err.status === 404) {
        // El trabajo ya no existe en la API: no hay nada que confirmar
        if (sinConfirmar.delete(id)) guardarEstado();
        return true;
      }
      if (!sinConfirmar.has(id)) {
        sinConfirmar.add(id);
        guardarEstado();
      }
      registro.error(`Tirilla #${id} impresa, pero no se pudo confirmar: ${err.message}`);
      return false;
    }
  }

  async function atender(nombre, destino) {
    if (ahora() < (pausaHasta[nombre] ?? 0)) return;
    let trabajos;
    try {
      trabajos = await api.pendientes(nombre);
    } catch (err) {
      registro.error(`No se pudo consultar la cola de ${nombre}: ${err.message}`);
      return;
    }
    for (const trabajo of trabajos) {
      if (sinConfirmar.has(trabajo.id)) continue; // ya salió: solo falta confirmarlo
      try {
        await imprimir(destino, trabajo);
      } catch (err) {
        registro.error(`No salió la tirilla #${trabajo.id} por ${nombre}: ${err.message}`);
        pausaHasta[nombre] = ahora() + esperaTrasErrorMs;
        try {
          await api.marcarError(trabajo.id, err.message);
        } catch (errApi) {
          registro.error(`Tampoco se pudo avisar el error a la API: ${errApi.message}`);
        }
        return; // no sigue con esta impresora: se respeta el orden de la cola
      }
      registro.info(
        `Impresa #${trabajo.id} (${trabajo.tipo}, pedido ${trabajo.pedidoId}) en ${nombre}`,
      );
      await confirmar(trabajo.id);
    }
  }

  async function ciclo() {
    if (ocupado) return;
    ocupado = true;
    try {
      for (const id of [...sinConfirmar]) await confirmar(id);
      for (const [nombre, destino] of Object.entries(impresoras)) {
        if (destino) await atender(nombre, destino);
      }
    } finally {
      ocupado = false;
    }
  }

  return { ciclo, sinConfirmar };
}

function leerEstado(archivo) {
  if (!archivo || !fs.existsSync(archivo)) return [];
  try {
    const ids = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    return Array.isArray(ids) ? ids.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

module.exports = { crearAgente };
