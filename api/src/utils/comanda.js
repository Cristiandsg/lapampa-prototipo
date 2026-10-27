// Arma el texto de la comanda que sale por la impresora térmica de cocina (HU04 → HU16).
// 32 caracteres por línea: cabe en papel de 58 mm y de 80 mm.
const ANCHO = 32;

const linea = (c = '-') => c.repeat(ANCHO);

function centrar(texto) {
  const t = texto.slice(0, ANCHO);
  const izquierda = Math.floor((ANCHO - t.length) / 2);
  return ' '.repeat(izquierda) + t;
}

// Parte un texto largo en líneas de máximo `ancho` caracteres, sin cortar palabras.
function partir(texto, ancho) {
  const palabras = String(texto).split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    if ((actual + ' ' + palabra).trim().length > ancho) {
      if (actual) lineas.push(actual);
      actual = palabra.slice(0, ancho);
    } else {
      actual = (actual + ' ' + palabra).trim();
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

function hora(fecha) {
  return new Date(fecha).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// pedido: { id, mesa, mesero, creado_en, observaciones, items: [{ cantidad, nombre, nota }] }
function armarComanda(pedido) {
  const filas = [
    centrar('LA PAMPA - COCINA'),
    linea('='),
    `MESA: ${pedido.mesa}`.slice(0, ANCHO),
    `Pedido #${pedido.id}`,
    `Hora: ${hora(pedido.creado_en)}`,
    `Mesero: ${pedido.mesero}`.slice(0, ANCHO),
    linea(),
  ];
  for (const item of pedido.items) {
    const cantidad = `${item.cantidad} x `;
    const [primera, ...resto] = partir(item.nombre, ANCHO - cantidad.length);
    filas.push(cantidad + primera);
    for (const r of resto) filas.push(' '.repeat(cantidad.length) + r);
    if (item.nota) {
      for (const n of partir(`* ${item.nota}`, ANCHO - 4)) filas.push(`    ${n}`);
    }
  }
  if (pedido.observaciones) {
    filas.push(linea());
    filas.push(...partir(`OBS: ${pedido.observaciones}`, ANCHO));
  }
  filas.push(linea('='));
  return filas.join('\n');
}

module.exports = { armarComanda, ANCHO };
