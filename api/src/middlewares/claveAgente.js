const crypto = require('crypto');

// HU16 — El agente de impresión del PC de la caja no inicia sesión como una persona: se
// identifica con una clave propia (CLAVE_AGENTE_IMPRESION, mínimo 16 caracteres) que viaja en
// el encabezado X-Clave-Agente. Se lee en cada petición para poder cambiarla sin reiniciar.
const MINIMO = 16;
const resumen = (texto) => crypto.createHash('sha256').update(String(texto)).digest();

function verificarClaveAgente(req, res, next) {
  const clave = process.env.CLAVE_AGENTE_IMPRESION;
  if (!clave || clave.length < MINIMO) {
    return res.status(503).json({
      error: 'La impresión no está configurada en el servidor (falta CLAVE_AGENTE_IMPRESION).',
    });
  }
  const enviada = req.get('X-Clave-Agente');
  // Comparación en tiempo constante: no deja adivinar la clave midiendo cuánto tarda
  if (!enviada || !crypto.timingSafeEqual(resumen(enviada), resumen(clave))) {
    return res.status(401).json({ error: 'Clave del agente de impresión inválida.' });
  }
  next();
}

module.exports = verificarClaveAgente;
