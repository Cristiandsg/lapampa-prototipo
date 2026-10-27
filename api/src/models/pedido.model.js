const pool = require('../config/db');
const { armarComanda, armarAjuste } = require('../utils/comanda');

const MAXIMO_POR_LINEA = 99;

function error(status, mensaje) {
  const e = new Error(mensaje);
  e.status = status;
  return e;
}

const limpiarNota = (nota) => (nota ? nota.trim() : '') || null;
const mismaNota = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

// "2 x Chumblún (sin cebolla)" — así queda cada cambio en el historial
function describir(cantidad, nombre, nota) {
  return `${cantidad} x ${nombre}${nota ? ` (${nota})` : ''}`.slice(0, 255);
}

// Junta líneas repetidas (mismo producto y misma nota) para que la comanda salga limpia.
function agrupar(items) {
  const mapa = new Map();
  for (const { productoId, cantidad, nota } of items) {
    const notaLimpia = limpiarNota(nota);
    const clave = `${productoId}|${(notaLimpia || '').toLowerCase()}`;
    const previo = mapa.get(clave);
    if (previo) previo.cantidad += cantidad;
    else mapa.set(clave, { productoId, cantidad, nota: notaLimpia });
  }
  return [...mapa.values()];
}

// Revisa que todos los productos existan y se puedan pedir hoy. Devuelve un Map id → producto.
async function productosDisponibles(conexion, lineas) {
  const ids = [...new Set(lineas.map((l) => l.productoId))];
  const [productos] = await conexion.query(
    `SELECT p.id, p.nombre, p.precio, p.activo, p.agotado_hoy, c.activa AS categoria_activa
       FROM producto p JOIN categoria c ON c.id = p.categoria_id
      WHERE p.id IN (?)`,
    [ids],
  );
  const porId = new Map(productos.map((p) => [p.id, { ...p, precio: Number(p.precio) }]));
  for (const id of ids) {
    const p = porId.get(id);
    if (!p) throw error(400, 'Uno de los productos no existe.');
    if (!p.activo || !p.categoria_activa) {
      throw error(409, `"${p.nombre}" ya no está en la carta.`);
    }
    if (p.agotado_hoy) throw error(409, `"${p.nombre}" está agotado hoy.`);
  }
  return porId;
}

async function registrarHistorial(conexion, pedidoId, accion, usuarioId, datos = {}) {
  await conexion.query(
    `INSERT INTO historial_cambio
       (entidad, entidad_id, accion, valor_anterior, valor_nuevo, motivo, usuario_id)
     VALUES ('pedido', ?, ?, ?, ?, ?, ?)`,
    [
      pedidoId,
      accion,
      datos.anterior ?? null,
      datos.nuevo ?? null,
      datos.motivo ?? null,
      usuarioId,
    ],
  );
}

async function encolarImpresion(conexion, tipo, pedidoId, contenido, usuarioId) {
  await conexion.query(
    `INSERT INTO trabajo_impresion (tipo, impresora, pedido_id, contenido, solicitado_por)
     VALUES (?, 'cocina', ?, ?, ?)`,
    [tipo, pedidoId, contenido, usuarioId],
  );
}

// Corre `trabajo` dentro de una transacción y libera la conexión pase lo que pase.
async function enTransaccion(trabajo) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const resultado = await trabajo(conexion);
    await conexion.commit();
    return resultado;
  } catch (err) {
    await conexion.rollback();
    throw err;
  } finally {
    conexion.release();
  }
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
  return enTransaccion(async (conexion) => {
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

    const porId = await productosDisponibles(conexion, lineas);
    const subtotal = lineas.reduce((s, l) => s + porId.get(l.productoId).precio * l.cantidad, 0);
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
    await registrarHistorial(conexion, pedidoId, 'crear', meseroId, {
      nuevo: `Mesa ${mesa.nombre} · ${lineas.length} productos · $${subtotal}`,
    });

    const pedido = await leer(conexion, pedidoId);
    pedido.comanda = armarComanda(pedido);
    await encolarImpresion(conexion, 'comanda', pedidoId, pedido.comanda, meseroId);
    return pedido;
  });
}

// ---------- HU05: modificar un pedido abierto ----------

const NO_ADMITE = {
  por_cobrar: 'ya tiene la cuenta generada',
  pagado: 'ya fue pagado',
  cancelado: 'fue anulado',
};

// Bloquea la mesa y el pedido, en ese orden (el mismo que usan HU03 y HU04, para que dos
// operaciones no se esperen en cruz). Si dos celulares cambian el mismo pedido a la vez,
// el segundo espera al primero y trabaja sobre el pedido ya actualizado.
async function bloquearAbierto(conexion, pedidoId) {
  const [[ref]] = await conexion.query('SELECT mesa_id FROM pedido WHERE id = ?', [pedidoId]);
  if (!ref) throw error(404, 'El pedido no existe.');
  let mesa = null;
  if (ref.mesa_id) {
    [[mesa]] = await conexion.query('SELECT id, nombre FROM mesa WHERE id = ? FOR UPDATE', [
      ref.mesa_id,
    ]);
  }
  const [[pedido]] = await conexion.query(
    'SELECT id, estado, mesa_id FROM pedido WHERE id = ? FOR UPDATE',
    [pedidoId],
  );
  if (pedido.estado !== 'abierto') {
    throw error(409, `El pedido #${pedidoId} ${NO_ADMITE[pedido.estado]}: no admite cambios.`);
  }
  return { ...pedido, mesa: mesa?.nombre ?? 'Domicilio' };
}

async function bloquearLinea(conexion, pedidoId, itemId) {
  const [[linea]] = await conexion.query(
    `SELECT d.id, d.producto_id, d.cantidad, d.precio_unitario, d.nota, pr.nombre
       FROM detalle_pedido d JOIN producto pr ON pr.id = d.producto_id
      WHERE d.id = ? AND d.pedido_id = ? FOR UPDATE`,
    [itemId, pedidoId],
  );
  if (!linea) throw error(404, 'Ese producto ya no está en el pedido.');
  return linea;
}

async function recalcularSubtotal(conexion, pedidoId) {
  await conexion.query(
    `UPDATE pedido
        SET subtotal = (SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
                          FROM detalle_pedido WHERE pedido_id = ?)
      WHERE id = ?`,
    [pedidoId, pedidoId],
  );
}

// Arma la tirilla de ajuste, la deja en la cola de cocina y devuelve el pedido actualizado.
async function cerrarAjuste(conexion, base, usuario, ajuste) {
  const [[{ ahora }]] = await conexion.query('SELECT NOW() AS ahora');
  const texto = armarAjuste({ ...ajuste, pedido: base, usuario: usuario.nombre, fecha: ahora });
  await encolarImpresion(conexion, 'ajuste_comanda', base.id, texto, usuario.id);
  const pedido = await leer(conexion, base.id);
  pedido.comanda = armarComanda(pedido);
  pedido.ajuste = texto;
  return pedido;
}

const notasDe = (nota) => (nota ? [`* ${nota}`] : []);

// POST /pedidos/:id/items — el cliente pide algo más. Si ya hay una línea con el mismo
// producto, la misma nota y el mismo precio, se le suma; si no, se crea otra (así un cambio
// de precio en la carta solo aplica a lo nuevo). A cocina va solo la adición.
async function agregarItems({ pedidoId, items, usuario }) {
  const lineas = agrupar(items);
  return enTransaccion(async (conexion) => {
    const base = await bloquearAbierto(conexion, pedidoId);
    const porId = await productosDisponibles(conexion, lineas);
    const [actuales] = await conexion.query(
      'SELECT id, producto_id, cantidad, precio_unitario, nota FROM detalle_pedido WHERE pedido_id = ?',
      [pedidoId],
    );

    for (const l of lineas) {
      const producto = porId.get(l.productoId);
      const igual = actuales.find(
        (a) =>
          a.producto_id === l.productoId &&
          mismaNota(a.nota, l.nota) &&
          Number(a.precio_unitario) === producto.precio,
      );
      if (igual) {
        if (igual.cantidad + l.cantidad > MAXIMO_POR_LINEA) {
          throw error(400, `No se pueden pedir más de ${MAXIMO_POR_LINEA} "${producto.nombre}".`);
        }
        await conexion.query('UPDATE detalle_pedido SET cantidad = cantidad + ? WHERE id = ?', [
          l.cantidad,
          igual.id,
        ]);
      } else {
        await conexion.query(
          `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, nota)
           VALUES (?, ?, ?, ?, ?)`,
          [pedidoId, l.productoId, l.cantidad, producto.precio, l.nota],
        );
      }
      await registrarHistorial(conexion, pedidoId, 'agregar_item', usuario.id, {
        nuevo: describir(l.cantidad, producto.nombre, l.nota),
      });
    }

    await recalcularSubtotal(conexion, pedidoId);
    return cerrarAjuste(conexion, base, usuario, {
      titulo: 'ADICIÓN',
      lineas: lineas.map((l) => ({
        texto: `+ ${l.cantidad} x ${porId.get(l.productoId).nombre}`,
        notas: notasDe(l.nota),
      })),
    });
  });
}

// PUT /pedidos/:id/items/:itemId — cambiar la cantidad o la nota de una línea.
// Bajar la cantidad de algo que ya se envió a cocina exige el motivo (criterio de HU05).
async function cambiarItem({ pedidoId, itemId, cantidad, nota, motivo, usuario }) {
  return enTransaccion(async (conexion) => {
    const base = await bloquearAbierto(conexion, pedidoId);
    const actual = await bloquearLinea(conexion, pedidoId, itemId);

    const nuevaCantidad = cantidad ?? actual.cantidad;
    const nuevaNota = nota === undefined ? actual.nota : limpiarNota(nota);
    const cambiaCantidad = nuevaCantidad !== actual.cantidad;
    const cambiaNota = !mismaNota(nuevaNota, actual.nota);
    if (!cambiaCantidad && !cambiaNota) {
      const pedido = await leer(conexion, pedidoId);
      pedido.comanda = armarComanda(pedido);
      pedido.ajuste = null;
      return pedido;
    }
    const baja = nuevaCantidad < actual.cantidad;
    if (baja && !motivo) {
      throw error(400, 'Escribe el motivo: ese producto ya se envió a cocina.');
    }

    await conexion.query('UPDATE detalle_pedido SET cantidad = ?, nota = ? WHERE id = ?', [
      nuevaCantidad,
      nuevaNota,
      itemId,
    ]);
    await registrarHistorial(conexion, pedidoId, 'cambiar_item', usuario.id, {
      anterior: describir(actual.cantidad, actual.nombre, actual.nota),
      nuevo: describir(nuevaCantidad, actual.nombre, nuevaNota),
      motivo: motivo || null,
    });
    await recalcularSubtotal(conexion, pedidoId);

    // A cocina: lo que se quita, lo que se agrega o la nota nueva
    let titulo;
    const lineas = [];
    const diferencia = nuevaCantidad - actual.cantidad;
    if (cambiaNota) {
      titulo = 'CAMBIO';
      lineas.push({
        texto: `${nuevaCantidad} x ${actual.nombre}`,
        notas: [`* antes: ${actual.nota || 'sin nota'}`, `* ahora: ${nuevaNota || 'sin nota'}`],
      });
      if (diferencia) {
        lineas.push({ texto: `(antes eran ${actual.cantidad})` });
      }
    } else if (diferencia > 0) {
      titulo = 'ADICIÓN';
      lineas.push({ texto: `+ ${diferencia} x ${actual.nombre}`, notas: notasDe(nuevaNota) });
    } else {
      titulo = 'ANULAR';
      lineas.push({ texto: `- ${-diferencia} x ${actual.nombre}`, notas: notasDe(nuevaNota) });
      lineas.push({ texto: `Quedan ${nuevaCantidad}` });
    }
    return cerrarAjuste(conexion, base, usuario, { titulo, lineas, motivo });
  });
}

// DELETE /pedidos/:id/items/:itemId — quitar una línea completa, siempre con motivo.
// Si era la única, el pedido queda anulado y la mesa libre (decisión del PO): pasa cuando
// el cliente se va sin consumir.
async function quitarItem({ pedidoId, itemId, motivo, usuario }) {
  return enTransaccion(async (conexion) => {
    const base = await bloquearAbierto(conexion, pedidoId);
    const linea = await bloquearLinea(conexion, pedidoId, itemId);

    await conexion.query('DELETE FROM detalle_pedido WHERE id = ?', [itemId]);
    await registrarHistorial(conexion, pedidoId, 'quitar_item', usuario.id, {
      anterior: describir(linea.cantidad, linea.nombre, linea.nota),
      motivo,
    });

    const [[{ quedan }]] = await conexion.query(
      'SELECT COUNT(*) AS quedan FROM detalle_pedido WHERE pedido_id = ?',
      [pedidoId],
    );
    const quitada = {
      texto: `- ${linea.cantidad} x ${linea.nombre}`,
      notas: notasDe(linea.nota),
    };

    if (quedan > 0) {
      await recalcularSubtotal(conexion, pedidoId);
      return cerrarAjuste(conexion, base, usuario, { titulo: 'ANULAR', lineas: [quitada], motivo });
    }

    await conexion.query(
      "UPDATE pedido SET estado = 'cancelado', subtotal = 0, cerrado_en = NOW() WHERE id = ?",
      [pedidoId],
    );
    if (base.mesa_id) {
      await conexion.query("UPDATE mesa SET estado = 'libre' WHERE id = ?", [base.mesa_id]);
    }
    await registrarHistorial(conexion, pedidoId, 'anular', usuario.id, {
      anterior: 'abierto',
      nuevo: 'cancelado',
      motivo,
    });
    return cerrarAjuste(conexion, base, usuario, {
      titulo: 'PEDIDO ANULADO',
      lineas: [quitada, { texto: 'No preparar nada de esta mesa.' }],
      motivo,
    });
  });
}

// Pedido con su mesa, mesero, detalle (con el precio guardado en el momento del pedido)
// e historial de cambios (quién, qué, cuándo y por qué).
async function leer(conexion, id) {
  const [[p]] = await conexion.query(
    `SELECT pe.id, pe.canal, pe.estado, pe.subtotal, pe.observaciones, pe.creado_en,
            pe.cerrado_en, pe.mesa_id, m.nombre AS mesa, u.nombre AS mesero
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
  const [historial] = await conexion.query(
    `SELECT h.id, h.accion, h.valor_anterior, h.valor_nuevo, h.motivo, h.creado_en,
            u.nombre AS usuario
       FROM historial_cambio h LEFT JOIN usuario u ON u.id = h.usuario_id
      WHERE h.entidad = 'pedido' AND h.entidad_id = ?
      ORDER BY h.id`,
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
    historial,
  };
}

async function obtener(id) {
  const pedido = await leer(pool, id);
  if (pedido) pedido.comanda = armarComanda(pedido);
  return pedido;
}

module.exports = { crearEnMesa, agregarItems, cambiarItem, quitarItem, obtener };
