// Crea la base de datos desde cero y carga los datos iniciales.
//   npm run db:init     -> schema.sql + seed.sql
//   npm run db:prueba   -> además carga datos_prueba.sql (productos y mesas de ejemplo)
// ¡Borra la base 'lapampa' si ya existe!
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function main() {
  const archivos = ['schema.sql', 'seed.sql'];
  if (process.argv.includes('--prueba')) archivos.push('datos_prueba.sql');

  const sinBase = { ...env.db };
  delete sinBase.database; // se conecta sin base porque schema.sql la crea
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
  console.error('No se pudo crear la base de datos:', err.message);
  process.exit(1);
});
