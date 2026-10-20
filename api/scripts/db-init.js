// Crea la base de datos desde cero y carga los datos iniciales.
//   npm run db:init     -> schema.sql + seed.sql
//   npm run db:prueba   -> además carga datos_prueba.sql (mesas de ejemplo)
//   npm run db:nube     -> schema.sql + seed.sql en la base de la nube (lee api/.env.nube)
// ¡Borra la base 'lapampa' si ya existe!
const fs = require('fs');
const path = require('path');

// Con --nube se leen primero los datos de api/.env.nube (que no se sube a GitHub).
// dotenv no pisa variables ya cargadas, así que .env.nube manda sobre .env.
if (process.argv.includes('--nube')) {
  const archivoNube = path.join(__dirname, '..', '.env.nube');
  if (!fs.existsSync(archivoNube)) {
    console.error('Falta api/.env.nube. Cópialo de api/.env.nube.example y pon los datos de Aiven.');
    process.exit(1);
  }
  require('dotenv').config({ path: archivoNube });
}

const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const archivos = ['schema.sql', 'seed.sql'];
  if (process.argv.includes('--prueba')) archivos.push('datos_prueba.sql');

  const sinBase = { ...env.db };
  delete sinBase.database; // se conecta sin base porque schema.sql la crea
  console.log(`Conectando a ${sinBase.host}:${sinBase.port} como ${sinBase.user}...`);
  const conexion = await mysql.createConnection({ ...sinBase, multipleStatements: true });
  try {
    for (const archivo of archivos) {
      const sql = fs.readFileSync(path.join(__dirname, '..', 'db', archivo), 'utf8');
      await conexion.query(sql);
      console.log(`✔ ${archivo}`);
    }
    console.log('Base de datos lista.');
  } finally {
    await conexion.end();
  }
}

main().catch((err) => {
  const detalle =
    err.code || err.message || (err.errors || []).map((e) => e.code || e.message).join(', ');
  console.error('No se pudo crear la base de datos:', detalle);
  if (String(detalle).includes('ECONNREFUSED')) {
    console.error('→ MySQL no está prendido o no escucha en ese host/puerto. Revisa XAMPP o el servicio MySQL.');
  }
  if (String(detalle).includes('ER_ACCESS_DENIED')) {
    console.error('→ Usuario o contraseña incorrectos en el archivo .env (DB_USER / DB_PASSWORD).');
  }
  if (String(detalle).includes('ENOTFOUND') || String(detalle).includes('ETIMEDOUT')) {
    console.error('→ No se encontró el servidor. Revisa DB_HOST y DB_PORT, y que el servicio de Aiven esté encendido.');
  }
  if (/SSL|certificate|HANDSHAKE/i.test(String(detalle))) {
    console.error('→ Problema de SSL. Revisa DB_SSL=true y que DB_SSL_CA tenga el certificado completo.');
  }
  process.exit(1);
});
