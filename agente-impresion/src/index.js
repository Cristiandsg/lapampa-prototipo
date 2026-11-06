// Agente de impresión de La Pampa (HU16). Corre en el PC fijo de la caja, donde están
// conectadas las dos impresoras térmicas (cocina y caja). Se inicia con: npm start
const fs = require('fs');
const path = require('path');
const { crearApi } = require('./api');
const { crearAgente } = require('./agente');
const { imprimir, tipoDeDestino } = require('./impresora');

const CARPETA = path.join(__dirname, '..');

// Lee el .env de esta carpeta (KEY=valor por línea) sin depender de paquetes externos
function cargarEnv(archivo) {
  if (!fs.existsSync(archivo)) return;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

function configuracion() {
  cargarEnv(path.join(CARPETA, '.env'));
  const c = {
    apiUrl: process.env.API_URL,
    clave: process.env.CLAVE_AGENTE,
    impresoras: {
      cocina: process.env.IMPRESORA_COCINA || '',
      caja: process.env.IMPRESORA_CAJA || '',
    },
    codificacion: process.env.CODIFICACION || 'cp1252',
    intervalo: Number(process.env.INTERVALO_MS) || 3000,
  };
  const problemas = [];
  if (!c.apiUrl) problemas.push('Falta API_URL.');
  if (!c.clave || c.clave.length < 16)
    problemas.push('CLAVE_AGENTE debe tener mínimo 16 caracteres.');
  for (const [nombre, destino] of Object.entries(c.impresoras)) {
    if (destino && !tipoDeDestino(destino)) {
      problemas.push(`IMPRESORA_${nombre.toUpperCase()} no es válida: ${destino}`);
    }
  }
  if (!c.impresoras.cocina && !c.impresoras.caja)
    problemas.push('Configura al menos una impresora.');
  if (!['cp1252', 'cp850'].includes(c.codificacion))
    problemas.push('CODIFICACION debe ser cp1252 o cp850.');
  if (problemas.length) {
    console.error(`No se puede iniciar el agente de impresión:\n- ${problemas.join('\n- ')}`);
    console.error('Revisa el archivo .env de la carpeta agente-impresion (ver .env.example).');
    process.exit(1);
  }
  return c;
}

const hora = () => new Date().toLocaleTimeString('es-CO', { hour12: false });
const registro = {
  info: (m) => console.log(`[${hora()}] ${m}`),
  error: (m) => console.error(`[${hora()}] ⚠ ${m}`),
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function iniciar() {
  const c = configuracion();
  const agente = crearAgente({
    api: crearApi({ url: c.apiUrl, clave: c.clave }),
    impresoras: c.impresoras,
    imprimir: (destino, trabajo) => imprimir(destino, trabajo, { codificacion: c.codificacion }),
    archivoEstado: path.join(CARPETA, 'impresas-sin-confirmar.json'),
    registro,
  });
  registro.info(`Agente de impresión iniciado. API: ${c.apiUrl}`);
  for (const [nombre, destino] of Object.entries(c.impresoras)) {
    registro.info(`  ${nombre}: ${destino || '(no la atiende este agente)'}`);
  }
  let seguir = true;
  process.on('SIGINT', () => {
    registro.info('Cerrando el agente…');
    seguir = false;
  });
  while (seguir) {
    await agente.ciclo();
    await dormir(c.intervalo);
  }
}

iniciar();
