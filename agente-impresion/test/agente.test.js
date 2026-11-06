const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { crearAgente } = require('../src/agente');
const { imprimir, tipoDeDestino } = require('../src/impresora');

const silencio = { info: () => {}, error: () => {} };

// API falsa en memoria con la misma lógica de la cola: pendientes y errores salen en orden
function apiFalsa(trabajos) {
  const cola = trabajos.map((t) => ({ estado: 'pendiente', intentos: 0, ...t }));
  const api = {
    cola,
    caida: false,
    confirmacionCaida: false,
    async pendientes(impresora) {
      if (api.caida) throw new Error('sin internet');
      return cola.filter((t) => t.impresora === impresora && t.estado !== 'impreso');
    },
    async marcarImpreso(id) {
      if (api.caida || api.confirmacionCaida) throw new Error('sin internet');
      const t = cola.find((x) => x.id === id);
      if (!t) throw Object.assign(new Error('no existe'), { status: 404 });
      t.estado = 'impreso';
    },
    async marcarError(id, mensaje) {
      if (api.caida) throw new Error('sin internet');
      const t = cola.find((x) => x.id === id);
      t.estado = 'error';
      t.intentos += 1;
      t.ultimoError = mensaje;
    },
  };
  return api;
}

// Impresoras falsas: registran lo impreso y se pueden "apagar"
function impresorasFalsas() {
  const salida = { cocina: [], caja: [] };
  const apagada = { cocina: false, caja: false };
  return {
    salida,
    apagada,
    imprimir: async (destino, trabajo) => {
      if (apagada[destino]) throw new Error(`La impresora de ${destino} no responde`);
      salida[destino].push(trabajo.id);
    },
  };
}

const TRABAJOS = [
  { id: 1, impresora: 'cocina', tipo: 'comanda', pedidoId: 10, contenido: 'A' },
  { id: 2, impresora: 'caja', tipo: 'cuenta', pedidoId: 9, contenido: 'B' },
  { id: 3, impresora: 'cocina', tipo: 'ajuste_comanda', pedidoId: 10, contenido: 'C' },
];

function armar({ archivoEstado = null } = {}) {
  const api = apiFalsa(TRABAJOS);
  const imp = impresorasFalsas();
  let reloj = 0;
  const agente = crearAgente({
    api,
    impresoras: { cocina: 'cocina', caja: 'caja' },
    imprimir: imp.imprimir,
    archivoEstado,
    esperaTrasErrorMs: 15000,
    ahora: () => reloj,
    registro: silencio,
  });
  return { api, imp, agente, avanzar: (ms) => (reloj += ms) };
}

test('imprime cada trabajo en su impresora, en orden, y lo confirma', async () => {
  const { api, imp, agente } = armar();
  await agente.ciclo();
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });
  assert.ok(api.cola.every((t) => t.estado === 'impreso'));
  await agente.ciclo(); // nada nuevo: no vuelve a imprimir
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });
});

test('impresora apagada: reporta el error, no se salta el orden y sale al prenderla', async () => {
  const { api, imp, agente, avanzar } = armar();
  imp.apagada.cocina = true;
  await agente.ciclo();

  // Cocina: el #1 queda con error y el #3 NO se imprime antes que él. Caja sigue normal.
  assert.deepEqual(imp.salida, { cocina: [], caja: [2] });
  assert.equal(api.cola[0].estado, 'error');
  assert.equal(api.cola[0].ultimoError, 'La impresora de cocina no responde');
  assert.equal(api.cola[2].estado, 'pendiente');

  // Durante la pausa no insiste
  imp.apagada.cocina = false;
  avanzar(5000);
  await agente.ciclo();
  assert.deepEqual(imp.salida.cocina, []);

  // Pasada la pausa, sale todo en orden y una sola vez
  avanzar(15000);
  await agente.ciclo();
  assert.deepEqual(imp.salida.cocina, [1, 3]);
  assert.ok(api.cola.every((t) => t.estado === 'impreso'));
});

test('si la tirilla salió pero no se pudo confirmar, no la imprime otra vez', async () => {
  const { api, imp, agente } = armar();
  api.confirmacionCaida = true;
  await agente.ciclo();
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });
  assert.deepEqual([...agente.sinConfirmar].sort(), [1, 2, 3]);

  // La API sigue viéndolos pendientes, pero el agente solo reintenta la confirmación
  await agente.ciclo();
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });

  api.confirmacionCaida = false;
  await agente.ciclo();
  assert.equal(agente.sinConfirmar.size, 0);
  assert.ok(api.cola.every((t) => t.estado === 'impreso'));
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });
});

test('recuerda en disco lo impreso sin confirmar: tras reiniciar el agente tampoco lo duplica', async () => {
  const archivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'agente-')), 'estado.json');
  const primero = armar({ archivoEstado: archivo });
  primero.api.confirmacionCaida = true;
  await primero.agente.ciclo();
  assert.deepEqual(JSON.parse(fs.readFileSync(archivo, 'utf8')).sort(), [1, 2, 3]);

  // Un agente nuevo (el PC se reinició) con la misma API todavía sin confirmar
  const imp = impresorasFalsas();
  const segundo = crearAgente({
    api: primero.api,
    impresoras: { cocina: 'cocina', caja: 'caja' },
    imprimir: imp.imprimir,
    archivoEstado: archivo,
    registro: silencio,
  });
  primero.api.confirmacionCaida = false;
  await segundo.ciclo();
  assert.deepEqual(imp.salida, { cocina: [], caja: [] });
  assert.ok(primero.api.cola.every((t) => t.estado === 'impreso'));
  assert.deepEqual(JSON.parse(fs.readFileSync(archivo, 'utf8')), []);
});

test('sin internet no imprime ni se cae; cuando vuelve, sigue', async () => {
  const { api, imp, agente } = armar();
  api.caida = true;
  await agente.ciclo();
  assert.deepEqual(imp.salida, { cocina: [], caja: [] });
  api.caida = false;
  await agente.ciclo();
  assert.deepEqual(imp.salida, { cocina: [1, 3], caja: [2] });
});

test('reconoce los tres tipos de destino', () => {
  assert.equal(tipoDeDestino('\\\\localhost\\Cocina'), 'windows');
  assert.equal(tipoDeDestino('tcp://192.168.1.50:9100'), 'red');
  assert.equal(tipoDeDestino('archivo:./tirillas'), 'archivo');
  assert.equal(tipoDeDestino('Cocina'), null);
  assert.equal(tipoDeDestino('\\\\localhost\\Cocina con espacio\\x'), null);
});

test('modo prueba: guarda la tirilla en un archivo de texto', async () => {
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tirillas-'));
  await imprimir(`archivo:${carpeta}`, {
    id: 7,
    impresora: 'cocina',
    tipo: 'comanda',
    contenido: '*** DOMICILIO ***\n2 x Chumblún\n',
  });
  const texto = fs.readFileSync(path.join(carpeta, '000007-cocina-comanda.txt'), 'utf8');
  assert.match(texto, /2 x Chumblún/);
});

test('impresora de red: le llegan los bytes ESC/POS; apagada da un error claro', async () => {
  const recibido = [];
  const servidor = net.createServer((s) => s.on('data', (d) => recibido.push(d)));
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const { port } = servidor.address();

  await imprimir(`tcp://127.0.0.1:${port}`, { id: 1, contenido: 'Hola' });
  await new Promise((r) => setTimeout(r, 50));
  const bytes = Buffer.concat(recibido);
  assert.deepEqual([...bytes.subarray(0, 2)], [0x1b, 0x40]);
  assert.match(bytes.toString('latin1'), /Hola/);

  await new Promise((r) => servidor.close(r));
  await assert.rejects(
    imprimir(`tcp://127.0.0.1:${port}`, { id: 2, contenido: 'x' }),
    /no está disponible \(ECONNREFUSED\)/,
  );
});
