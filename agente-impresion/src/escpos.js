// Arma los bytes ESC/POS de una tirilla a partir del texto que ya preparó la API
// (32 caracteres por línea, ver api/src/utils/comanda.js).

const ESC = 0x1b;
const GS = 0x1d;

// Página de códigos que se le pide a la impresora con ESC t n
const TABLAS = {
  cp1252: 16, // WPC1252: Epson y compatibles
  cp850: 2, // PC850 multilingüe: muchas genéricas de 58 mm
};

// Lo que hay en la tirilla y no existe en las páginas de códigos de las impresoras
const REEMPLAZOS = {
  '—': '-',
  '–': '-',
  '…': '...',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '•': '*',
  '·': '-',
  ' ': ' ',
};

// En PC850 las letras del español quedan en otras posiciones que en Latin-1
const CP850 = {
  á: 0xa0,
  é: 0x82,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  ü: 0x81,
  Ü: 0x9a,
  Á: 0xb5,
  É: 0x90,
  Í: 0xd6,
  Ó: 0xe0,
  Ú: 0xe9,
  '¿': 0xa8,
  '¡': 0xad,
  '°': 0xf8,
};

function codificar(texto, codificacion) {
  const bytes = [];
  for (const caracter of texto.replace(/\r\n?/g, '\n')) {
    // Los reemplazos son ASCII; un emoji ocupa dos posiciones en JS pero es un solo carácter
    if (REEMPLAZOS[caracter] !== undefined) {
      bytes.push(...Buffer.from(REEMPLAZOS[caracter], 'latin1'));
      continue;
    }
    const c = caracter;
    const punto = c.codePointAt(0);
    if (punto < 0x80) bytes.push(punto);
    else if (codificacion === 'cp850' && CP850[c] !== undefined) bytes.push(CP850[c]);
    // Latin-1 coincide con CP1252 en todas las letras del español
    else if (codificacion === 'cp1252' && punto <= 0xff) bytes.push(punto);
    else bytes.push(0x3f); // '?'
  }
  return bytes;
}

// Devuelve un Buffer listo para mandar a la impresora:
// inicializar → tabla de caracteres → texto → avanzar papel → cortar
function armarTirilla(texto, { codificacion = 'cp1252', cortar = true } = {}) {
  if (!TABLAS[codificacion]) throw new Error(`Codificación no soportada: ${codificacion}`);
  const cuerpo = codificar(texto.endsWith('\n') ? texto : `${texto}\n`, codificacion);
  // prettier-ignore
  return Buffer.from([
    ESC, 0x40, // ESC @: reinicia la impresora
    ESC, 0x74, TABLAS[codificacion], // ESC t n: tabla de caracteres
    ...cuerpo,
    ESC, 0x64, 4, // ESC d 4: avanza 4 líneas para que el corte no se coma el texto
    ...(cortar ? [GS, 0x56, 0x42, 0x00] : []), // GS V 66 0: corte parcial
  ]);
}

module.exports = { armarTirilla, codificar, TABLAS };
