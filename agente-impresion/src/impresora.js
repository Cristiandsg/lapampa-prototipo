// Envía una tirilla a su destino. El destino sale de la configuración (.env):
//   \\localhost\Cocina        impresora compartida de Windows
//   tcp://192.168.1.50:9100   impresora térmica de red
//   archivo:./tirillas        modo prueba, sin impresora
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const { execFile } = require('child_process');
const { armarTirilla } = require('./escpos');

const ESPERA_MS = 10000;

function tipoDeDestino(destino) {
  if (/^\\\\[^\\]+\\[^\\]+$/.test(destino)) return 'windows';
  if (/^tcp:\/\/[^:/]+:\d+$/.test(destino)) return 'red';
  if (/^archivo:.+/.test(destino)) return 'archivo';
  return null;
}

// Copia los bytes en crudo a la impresora compartida (como "copy /b tirilla.bin \\PC\Cocina").
// Windows deja el trabajo en su cola de impresión: si la impresora está apagada pero
// instalada, la tirilla sale cuando la prendan.
function enviarAWindows(destino, bytes) {
  const temporal = path.join(os.tmpdir(), `lapampa-${process.pid}-${Date.now()}.bin`);
  fs.writeFileSync(temporal, bytes);
  return new Promise((resolver, rechazar) => {
    execFile(
      'cmd.exe',
      ['/d', '/c', 'copy', '/b', temporal, destino],
      { timeout: ESPERA_MS, windowsHide: true },
      (err, salida) => {
        fs.rm(temporal, { force: true }, () => {});
        if (err) {
          const detalle = (salida || err.message).toString().trim().split('\n').pop();
          return rechazar(new Error(`No se pudo enviar a ${destino}: ${detalle}`));
        }
        resolver();
      },
    );
  });
}

// Impresora de red en el puerto 9100 (RAW). Si está apagada, la conexión falla.
function enviarPorRed(destino, bytes) {
  const [, host, puerto] = destino.match(/^tcp:\/\/([^:/]+):(\d+)$/);
  return new Promise((resolver, rechazar) => {
    const socket = net.createConnection({ host, port: Number(puerto) });
    socket.setTimeout(ESPERA_MS);
    socket.on('connect', () => socket.end(bytes));
    socket.on('close', (conError) => (conError ? null : resolver()));
    socket.on('timeout', () => {
      socket.destroy();
      rechazar(new Error(`La impresora ${host}:${puerto} no responde.`));
    });
    socket.on('error', (err) =>
      rechazar(new Error(`La impresora ${host}:${puerto} no está disponible (${err.code}).`)),
    );
  });
}

// Modo prueba: guarda el texto (legible) para revisar cómo quedó cada tirilla
function guardarEnArchivo(destino, texto, trabajo) {
  const carpeta = path.resolve(destino.replace(/^archivo:/, ''));
  fs.mkdirSync(carpeta, { recursive: true });
  const nombre = `${String(trabajo.id).padStart(6, '0')}-${trabajo.impresora}-${trabajo.tipo}.txt`;
  fs.writeFileSync(path.join(carpeta, nombre), texto, 'utf8');
}

// Imprime un trabajo de la cola. Si algo falla, lanza un error con un mensaje en español
// que el agente reporta a la API (y que el personal ve en el aviso de la pantalla).
async function imprimir(destino, trabajo, { codificacion = 'cp1252' } = {}) {
  const tipo = tipoDeDestino(destino);
  if (tipo === 'archivo') return guardarEnArchivo(destino, trabajo.contenido, trabajo);
  const bytes = armarTirilla(trabajo.contenido, { codificacion });
  if (tipo === 'windows') return enviarAWindows(destino, bytes);
  if (tipo === 'red') return enviarPorRed(destino, bytes);
  throw new Error(`Destino de impresora no válido: ${destino}`);
}

module.exports = { imprimir, tipoDeDestino };
