const negocio = require('../config/negocio');

// HU09 — Límite de envíos por dispositivo en el formulario público: como no pide inicio de
// sesión, evita que alguien llene la cocina de pedidos falsos. El dispositivo se reconoce
// por su dirección IP (detrás de Render, app.js confía en el proxy para leer la IP real).
// Solo cuentan los pedidos que sí se registraron (respuesta 201): un formulario con errores
// no gasta intentos.
// Los conteos viven en memoria: si la API se reinicia (Render la duerme tras 15 minutos sin
// uso), vuelven a cero. Para el prototipo es suficiente; con varias instancias haría falta
// guardarlos en la base.
const envios = new Map(); // ip → [marcas de tiempo de los pedidos registrados]

function recientes(ip, ahora) {
  const desde = ahora - negocio.limitePedidos.ventanaMs;
  const lista = (envios.get(ip) || []).filter((t) => t > desde);
  if (lista.length) envios.set(ip, lista);
  else envios.delete(ip);
  return lista;
}

function limitePedidos(req, res, next) {
  const ahora = Date.now();
  const ip = req.ip;
  const lista = recientes(ip, ahora);
  const { maximo, ventanaMs } = negocio.limitePedidos;
  if (lista.length >= maximo) {
    const minutos = Math.ceil((lista[0] + ventanaMs - ahora) / 60000);
    res.set('Retry-After', String(minutos * 60));
    return res.status(429).json({
      error: `Ya enviaste ${maximo} pedidos en la última hora desde este dispositivo. Intenta de nuevo en ${minutos} minutos o llámanos por WhatsApp al ${negocio.whatsapp}.`,
    });
  }
  res.on('finish', () => {
    if (res.statusCode === 201) envios.set(ip, [...recientes(ip, Date.now()), Date.now()]);
  });
  next();
}

// Solo para las pruebas: empieza cada caso sin envíos previos.
limitePedidos.reiniciar = () => envios.clear();

module.exports = limitePedidos;
