const mysql = require('mysql2/promise');
const env = require('./env');

// Pool de conexiones compartido por todos los modelos.
// Para transacciones (cierre de pedido, pago, propina) se pide una conexión
// con pool.getConnection() y se usa beginTransaction / commit / rollback.
const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '-05:00',
  decimalNumbers: true,
});

module.exports = pool;
