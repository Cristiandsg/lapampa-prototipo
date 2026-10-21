// Se ejecuta una vez antes de todas las pruebas: crea la base "lapampa_test" desde cero
// con el mismo schema.sql y seed.sql del proyecto. Así las pruebas nunca tocan la base
// "lapampa" de desarrollo. Requiere MySQL prendido (XAMPP) con los datos de api/.env.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const BASE_PRUEBA = 'lapampa_test';

function cambiarBase(sql) {
  return sql
    .split('\n')
    .map((linea) =>
      /^\s*(DROP DATABASE|CREATE DATABASE|USE)\b/i.test(linea)
        ? linea.replace(/\blapampa\b/, BASE_PRUEBA)
        : linea,
    )
    .join('\n');
}

module.exports = async function crearBaseDePrueba() {
  require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
  const env = require('../../src/config/env');
  const sinBase = { ...env.db };
  delete sinBase.database;
  let conexion;
  try {
    conexion = await mysql.createConnection({ ...sinBase, multipleStatements: true });
  } catch (err) {
    throw new Error(
      `Las pruebas necesitan MySQL prendido (XAMPP) y los datos de api/.env. Error: ${err.code || err.message}`,
    );
  }
  try {
    for (const archivo of ['schema.sql', 'seed.sql']) {
      const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', archivo), 'utf8');
      await conexion.query(cambiarBase(sql));
    }
  } finally {
    await conexion.end();
  }
};
