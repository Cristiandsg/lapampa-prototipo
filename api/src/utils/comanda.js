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

// HU05 — Tirilla de ajuste para cocina: solo lo que cambió, no el pedido entero, para que
// no se prepare dos veces lo mismo.
// ajuste: { titulo: 'ADICIÓN' | 'ANULAR' | 'CAMBIO' | 'PEDIDO ANULADO', pedido, usuario,
//           fecha, motivo?, lineas: [{ texto: '+ 2 x Chumblún', notas: ['* sin cebolla'] }] }
function armarAjuste({ titulo, pedido, usuario, fecha, motivo, lineas }) {
  const filas = [
    centrar('LA PAMPA - COCINA'),
    linea('='),
    centrar(`*** ${titulo} ***`),
    `MESA: ${pedido.mesa}`.slice(0, ANCHO),
    `Pedido #${pedido.id}`,
    `Hora: ${hora(fecha)}`,
    `Por: ${usuario}`.slice(0, ANCHO),
    linea(),
  ];
  for (const { texto, notas = [] } of lineas) {
    const [primera, ...resto] = partir(texto, ANCHO);
    filas.push(primera);
    for (const r of resto) filas.push(`    ${r}`.slice(0, ANCHO));
    for (const nota of notas) {
      for (const n of partir(nota, ANCHO - 4)) filas.push(`    ${n}`);
    }
  }
  if (motivo) {
    filas.push(linea());
    filas.push(...partir(`MOTIVO: ${motivo}`, ANCHO));
  }
  filas.push(linea('='));
  return filas.join('\n');
}

const SANGRIA = '    ';
const pesos = (valor) => `$${Math.round(valor).toLocaleString('es-CO')}`;

// "2 x Chumblún ......... $46.000" en 32 columnas; si el nombre es largo, el valor va en la
// última línea del nombre.
function filaValor(texto, valor) {
  const precio = pesos(valor);
  const cabe = ANCHO - precio.length - 1;
  const partes =
    texto.length <= cabe
      ? [texto]
      : partir(texto, cabe - SANGRIA.length).map((p, i) => (i ? SANGRIA + p : p));
  const ultima = partes.pop();
  return [...partes, ultima + ' '.repeat(ANCHO - ultima.length - precio.length) + precio];
}

// HU06 — La cuenta que se le entrega al cliente (impresora de caja, HU16).
// Dice "Cuenta", nunca "factura": la facturación electrónica está fuera del alcance.
// La propina va aparte y es voluntaria (Ley 1935 de 2018): nunca se suma al total.
// pedido: { id, mesa, mesero, cerrado_en, subtotal, propina_sugerida, items }
function armarCuenta(pedido, fecha = pedido.cerrado_en || new Date()) {
  const filas = [
    centrar('LA PAMPA GASTROBAR'),
    linea('='),
    centrar('CUENTA'),
    `MESA: ${pedido.mesa}`.slice(0, ANCHO),
    `Pedido #${pedido.id}`,
    `Fecha: ${hora(fecha)}`,
    `Atendió: ${pedido.mesero}`.slice(0, ANCHO),
    linea(),
  ];
  for (const item of pedido.items) {
    filas.push(...filaValor(`${item.cantidad} x ${item.nombre}`, item.total));
    if (item.cantidad > 1) filas.push(`    ${pesos(item.precio_unitario)} c/u`);
  }
  filas.push(linea());
  filas.push(...filaValor('TOTAL', pedido.subtotal));
  filas.push(linea('='));
  filas.push(...filaValor('Propina sugerida (10 %)', pedido.propina_sugerida));
  filas.push(...partir('La propina es voluntaria: usted decide si la da y cuánto.', ANCHO));
  filas.push(linea());
  filas.push(centrar('Este documento no es factura.'));
  filas.push(centrar('¡Gracias por su visita!'));
  return filas.join('\n');
}

const MEDIO = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

// HU07/HU08 — Comprobante de pago para el cliente (impresora de caja, HU16).
// El consumo y la propina van en líneas separadas; el total pagado es la suma de los dos.
// pedido: { id, mesa, pagado_en, subtotal, propina: { valor }, pagos: [{ medio, valor, referencia }] }
function armarComprobante(pedido) {
  const propina = pedido.propina?.valor ?? 0;
  const filas = [
    centrar('LA PAMPA GASTROBAR'),
    linea('='),
    centrar('COMPROBANTE DE PAGO'),
    `MESA: ${pedido.mesa ?? 'Domicilio'}`.slice(0, ANCHO),
    `Pedido #${pedido.id}`,
    `Fecha: ${hora(pedido.pagado_en || new Date())}`,
    linea(),
    ...filaValor('Consumo', pedido.subtotal),
    ...filaValor(propina ? 'Propina voluntaria' : 'Propina: no', propina),
    linea(),
    ...filaValor('TOTAL PAGADO', pedido.subtotal + propina),
    linea('='),
  ];
  for (const pago of pedido.pagos ?? []) {
    filas.push(...filaValor(MEDIO[pago.medio] ?? pago.medio, pago.valor));
    if (pago.referencia) filas.push(`    Ref. ${pago.referencia}`.slice(0, ANCHO));
  }
  filas.push(linea());
  filas.push(centrar('Este documento no es factura.'));
  filas.push(centrar('¡Gracias por su visita!'));
  return filas.join('\n');
}

module.exports = { armarComanda, armarAjuste, armarCuenta, armarComprobante, ANCHO };
