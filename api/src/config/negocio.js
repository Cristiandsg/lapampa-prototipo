// Datos del negocio que usa el canal de domicilios (HU09). Los confirmó el PO con el
// propietario el 5 de noviembre de 2026. Se pueden cambiar en api/.env (o en Render) sin
// tocar el código; si no se configuran, quedan estos valores.
const numero = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : porDefecto;
};

const negocio = {
  // Valor fijo del envío, en pesos. Es temporal: más adelante puede depender del barrio.
  valorEnvio: numero(process.env.VALOR_ENVIO, 7000),
  // WhatsApp del local: el cliente envía ahí el comprobante de la transferencia.
  whatsapp: process.env.WHATSAPP_LOCAL || '3195654739',
  transferencia: {
    banco: process.env.TRANSFERENCIA_BANCO || 'Bancolombia',
    tipo: process.env.TRANSFERENCIA_TIPO || 'Cuenta de ahorros',
    numero: process.env.TRANSFERENCIA_NUMERO || '80819808345',
    titular: process.env.TRANSFERENCIA_TITULAR || null, // pendiente de confirmar
  },
  // Límite de pedidos públicos por dispositivo (dirección IP) en una ventana de tiempo.
  limitePedidos: {
    maximo: numero(process.env.LIMITE_PEDIDOS_HORA, 5),
    ventanaMs: 60 * 60 * 1000,
  },
};

module.exports = negocio;
