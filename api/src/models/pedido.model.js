const pool = require('../config/db');
const { armarComanda } = require('../utils/comanda');

function error(status, mensaje) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

// Junta líneas repetidas (mismo producto y misma nota) para que la comanda salga limpia.
function agrupar(items) {
  const mapa = new Map();
  for (const { productoId, cantidad, nota } of items) {
    const notaLimpia = nota ? nota.trim() : '';
    const clave = `${productoId}|${notaLimpia.toLowerCase()}`;
    const previo = mapa.get(clave);
    if (previo) previo.cantidad += cantidad;
    else mapa.set(clave, { productoId, cantidad, nota: notaLimpia || null });
  }
  return [...mapa.values()];
}

// HU04 — Registra un pedido de mesa en una sola transacción:
// 1. bloquea la mesa (SELECT ... FOR UPDATE): si dos meseros la abren a la vez, uno espera
//    al otro y el segundo encuentra la mesa ocupada;
// 2. toma el precio actual de cada producto (queda guardado en el detalle);
// 3. guarda pedido y detalle, marca la mesa ocupada, deja la comanda en la cola de
//    impresión de cocina (HU16) y registra quién lo hizo.
// Si algo falla, no queda nada a medias.
async function crearEnMesa({ mesaId, meseroId, items, observaciones }) {
  const lineas = agrupar(items);
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    const [[mesa]] = await conexion.query(
      'SELECT id, nombre, estado FROM mesa WHERE id = ? AND activa = TRUE FOR UPDATE',
      [mesaId],
    );
    if (!mesa) throw error(404, 'La mesa no existe o ya fue eliminada.');
    const [[vigente]] = await conexion.query(
      "SELECT id FROM pedido WHERE mesa_id = ? AND estado IN ('abierto', 'por_cobrar') LIMIT 1",
      [mesaId],
    );
    if (vigente || mesa.estado !== 'libre') {
      throw error(409, `La mesa "${mesa.nombre}" ya tiene un pedido abierto.`);
    }

    const ids = [...new Set(lineas.map((l) => l.productoId))];
    const [productos] = await conexion.query(
      `SELECT p.id, p.nombre, p.precio, p.activo, p.agotado_hoy, c.activa AS categoria_activa
         FROM producto p JOIN categoria c ON c.id = p.categoria_id
        WHERE p.id IN (?)`,
      [ids],
    );
    const porId = new Map(productos.map((p) => [p.id, p]));
    for (const id of ids) {
      const p = porId.get(id);
      if (!p) throw error(400, 'Uno de los productos no existe.');
      if (!p.activo || !p.categoria_activa) {
        throw error(409, `"${p.nombre}" ya no está en la carta.`);
      }
      if (p.agotado_hoy) throw error(409, `"${p.nombre}" está agotado hoy.`);
    }

    const subtotal = lineas.reduce(
      (suma, l) => suma + Number(porId.get(l.productoId).precio) * l.cantidad,
      0,
    );
    const [r] = await conexion.query(
      `INSERT INTO pedido (canal, mesa_id, mesero_id, subtotal, observaciones)
       VALUES ('mesa', ?, ?, ?, ?)`,
      [mesaId, meseroId, subtotal, observaciones || null],
    );
    const pedidoId = r.insertId;

    for (const l of lineas) {
      await conexion.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, nota)
         VALUES (?, ?, ?, ?, ?)`,
        [pedidoId, l.productoId, l.cantidad, porId.get(l.productoId).precio, l.nota],
      );
    }

    await conexion.query("UPDATE mesa SET estado = 'ocupada' WHERE id = ?", [mesaId]);
    await conexion.query(
      `INSERT INTO historial_cambio (entidad, entidad_id, accion, valor_nuevo, usuario_id)
       VALUES ('pedido', ?, 'crear', ?, ?)`,
      [pedidoId, `Mesa ${mesa.nombre} · ${lineas.length} productos · $${subtotal}`, meseroId],
    );

    const pedido = await leer(conexion, pedidoId);
    pedido.comanda = armarComanda(pedido);
    await conexion.query(
      `INSERT INTO trabajo_impresion (tipo, impresora, pedido_id, contenido, solicitado_por)
       VALUES ('comanda', 'cocina', ?, ?, ?)`,
      [pedidoId, pedido.comanda, meseroId],
    );

    await conexion.commit();
    return pedido;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
}

// Pedido con su mesa, mesero y detalle (con el precio guardado en el momento del pedido).
async function leer(conexion, id) {
  const [[p]] = await conexion.query(
    `SELECT pe.id, pe.canal, pe.estado, pe.subtotal, pe.observaciones, pe.creado_en,
            pe.mesa_id, m.nombre AS mesa, u.nombre AS mesero
       FROM pedido pe
       LEFT JOIN mesa m ON m.id = pe.mesa_id
       LEFT JOIN usuario u ON u.id = pe.mesero_id
      WHERE pe.id = ?`,
    [id],
  );
  if (!p) return null;
  const [items] = await conexion.query(
    `SELECT d.id, d.producto_id, pr.nombre, d.cantidad, d.precio_unitario, d.nota
       FROM detalle_pedido d JOIN producto pr ON pr.id = d.producto_id
      WHERE d.pedido_id = ?
      ORDER BY d.id`,
    [id],
  );
  return {
    ...p,
    subtotal: Number(p.subtotal),
    items: items.map((i) => ({
      ...i,
      precio_unitario: Number(i.precio_unitario),
      total: Number(i.precio_unitario) * i.cantidad,
    })),
  };
}

async function obtener(id) {
  const pedido = await leer(pool, id);
  if (pedido) pedido.comanda = armarComanda(pedido);
  return pedido;
}

module.exports = { crearEnMesa, obtener };
