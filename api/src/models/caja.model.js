const pool = require('../config/db');

const MEDIOS = ['efectivo', 'tarjeta', 'transferencia'];

// HU07 — Cierre de caja de un día (fecha 'AAAA-MM-DD'; si no llega, hoy en Colombia).
// La conexión a la base trabaja en hora de Colombia, así que "el día" va de 00:00 a 23:59
// de Cali aunque el servidor esté en otro país. Se filtra por rango (no con DATE()) para
// que MySQL use el índice de fecha: la consulta tarda milisegundos (criterio: < 5 s).
async function cierre(fecha) {
  const [[{ dia }]] = await pool.query(
    "SELECT DATE_FORMAT(COALESCE(?, CURDATE()), '%Y-%m-%d') AS dia",
    [fecha ?? null],
  );
  const rango = 'BETWEEN ? AND ? + INTERVAL 1 DAY - INTERVAL 1 SECOND';
  const desde = [dia, dia];

  const [porMedio] = await pool.query(
    `SELECT medio, SUM(valor) AS total, COUNT(*) AS pagos
       FROM pago WHERE creado_en ${rango}
      GROUP BY medio`,
    desde,
  );
  const [[ventas]] = await pool.query(
    `SELECT COUNT(*) AS pedidos, COALESCE(SUM(subtotal), 0) AS consumo
       FROM pedido WHERE estado = 'pagado' AND pagado_en ${rango}`,
    desde,
  );
  // HU08 — Propinas del día, para liquidarlas a cada mesero
  const [propinas] = await pool.query(
    `SELECT pr.mesero_id, u.nombre AS mesero, SUM(pr.valor) AS total, COUNT(*) AS pedidos,
            SUM(pr.respuesta = 'aceptada') AS aceptadas,
            SUM(pr.respuesta = 'modificada') AS modificadas,
            SUM(pr.respuesta = 'rechazada') AS rechazadas
       FROM propina pr
       JOIN pedido pe ON pe.id = pr.pedido_id
       LEFT JOIN usuario u ON u.id = pr.mesero_id
      WHERE pe.estado = 'pagado' AND pe.pagado_en ${rango}
      GROUP BY pr.mesero_id, u.nombre
      ORDER BY total DESC, u.nombre`,
    desde,
  );
  const [[pendientes]] = await pool.query(
    `SELECT COUNT(*) AS cantidad, COALESCE(SUM(subtotal), 0) AS total
       FROM pedido WHERE estado = 'por_cobrar'`,
  );

  const medios = MEDIOS.map((medio) => {
    const fila = porMedio.find((f) => f.medio === medio);
    return { medio, total: Number(fila?.total ?? 0), pagos: Number(fila?.pagos ?? 0) };
  });
  const porMesero = propinas.map((p) => ({
    mesero: p.mesero ?? 'Sin mesero',
    total: Number(p.total),
    pedidos: Number(p.pedidos),
    aceptadas: Number(p.aceptadas),
    modificadas: Number(p.modificadas),
    rechazadas: Number(p.rechazadas),
  }));
  const totalPropinas = porMesero.reduce((s, p) => s + p.total, 0);

  return {
    fecha: dia,
    pedidosPagados: Number(ventas.pedidos),
    consumo: Number(ventas.consumo),
    propinas: { total: totalPropinas, porMesero },
    porMedio: medios,
    totalRecaudado: medios.reduce((s, m) => s + m.total, 0),
    porCobrar: { cantidad: Number(pendientes.cantidad), total: Number(pendientes.total) },
  };
}

module.exports = { cierre, MEDIOS };
