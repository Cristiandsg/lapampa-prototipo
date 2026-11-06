// Cliente de la API para el agente: pide la cola y confirma lo impreso.
// Se identifica con la clave propia del agente (encabezado X-Clave-Agente), no con usuario.

// Render gratis se duerme: la primera consulta después de un rato puede tardar casi un minuto
const ESPERA_MS = 70000;

function crearApi({ url, clave, fetch = globalThis.fetch, esperaMs = ESPERA_MS }) {
  const base = url.replace(/\/+$/, '');

  async function pedir(metodo, ruta, cuerpo) {
    const respuesta = await fetch(`${base}${ruta}`, {
      method: metodo,
      headers: {
        'X-Clave-Agente': clave,
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(esperaMs),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      const error = new Error(datos.error || `La API respondió ${respuesta.status}`);
      error.status = respuesta.status;
      throw error;
    }
    return datos;
  }

  return {
    pendientes: (impresora) =>
      pedir('GET', `/impresion/pendientes?impresora=${encodeURIComponent(impresora)}`),
    marcarImpreso: (id) => pedir('PATCH', `/impresion/${id}`, { estado: 'impreso' }),
    marcarError: (id, mensaje) =>
      pedir('PATCH', `/impresion/${id}`, { estado: 'error', error: mensaje.slice(0, 255) }),
  };
}

module.exports = { crearApi };
