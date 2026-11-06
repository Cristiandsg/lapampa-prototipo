const { test } = require('node:test');
const assert = require('node:assert/strict');
const { armarTirilla, codificar } = require('../src/escpos');

test('la tirilla reinicia la impresora, elige la tabla de caracteres, avanza y corta', () => {
  const b = armarTirilla('MESA: Terraza 2\n');
  assert.deepEqual([...b.subarray(0, 5)], [0x1b, 0x40, 0x1b, 0x74, 16]);
  assert.equal(b.subarray(5, 20).toString('latin1'), 'MESA: Terraza 2');
  assert.deepEqual([...b.subarray(-7)], [0x1b, 0x64, 4, 0x1d, 0x56, 0x42, 0x00]);
});

test('agrega el salto de línea final si falta y puede no cortar', () => {
  const b = armarTirilla('Hola', { cortar: false });
  assert.equal(b[9], 0x0a);
  assert.deepEqual([...b.subarray(-3)], [0x1b, 0x64, 4]);
});

test('las tildes, la ñ y los signos del español salen bien en CP1252', () => {
  assert.deepEqual(codificar('Chumblún ñ ¿¡', 'cp1252'), [
    ...Buffer.from('Chumbl', 'latin1'),
    0xfa,
    0x6e,
    0x20,
    0xf1,
    0x20,
    0xbf,
    0xa1,
  ]);
});

test('en CP850 usa las posiciones de esa tabla', () => {
  const b = armarTirilla('Ñ á', { codificacion: 'cp850' });
  assert.equal(b[4], 2); // ESC t 2
  assert.deepEqual([...b.subarray(5, 8)], [0xa5, 0x20, 0xa0]);
});

test('reemplaza los signos tipográficos y lo que la impresora no tiene', () => {
  assert.equal(Buffer.from(codificar('a—b…“c”', 'cp1252')).toString('latin1'), 'a-b..."c"');
  assert.equal(Buffer.from(codificar('🍤', 'cp1252')).toString('latin1'), '?');
  assert.equal(Buffer.from(codificar('línea\r\notra', 'cp1252')).toString('latin1'), 'línea\notra');
});

test('rechaza una codificación desconocida', () => {
  assert.throws(() => armarTirilla('x', { codificacion: 'utf8' }), /no soportada/);
});
