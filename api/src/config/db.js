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

// Cada conexión trabaja en hora de Colombia: así NOW() y CURRENT_TIMESTAMP coinciden
// con la hora del local aunque el servidor de la base esté en UTC (Aiven).
pool.pool.on('connection', (conexion) => {
  conexion.query("SET time_zone = '-05:00'");
});

module.exports = pool;
