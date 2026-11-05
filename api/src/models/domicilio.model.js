const negocio = require('../config/negocio');
const pedidoModel = require('./pedido.model');

const { agrupar, productosDisponibles, enTransaccion, registrarHistorial, encolarImpresion, leer } =
  pedidoModel.interno;

// Cómo llegó la autorización de datos (Ley 1581 de 2012), según el canal del domicilio
const MEDIO_AUTORIZACION = { web: 'formulario_web', telefono_whatsapp: 'telefono_whatsapp' };

// HU09 — Registra un pedido a domicilio en una sola transacción. La usa el formulario web
// del cliente (canal 'web', registradoPor null) y la reutiliza HU10 cuando el cajero registra
// un pedido que llegó por llamada o WhatsApp (canal 'telefono_whatsapp', registradoPor = cajero).
//
// 1. Guarda el cliente, o actualiza sus datos si el teléfono ya existe, con la fecha y el
//    medio de la autorización de datos. Sin autorización la ruta responde 400 antes de llegar
//    aquí, y la base también lo impide (CHECK ck_cliente_autoriza).
// 2. Toma el precio actual de cada producto (queda guardado en el detalle) y el valor del
//    envío vigente (queda guardado en el domicilio).
// 3. Crea el pedido (canal 'domicilio', sin mesa ni mesero), su detalle y el domicilio:
//    - por transferencia queda en 'pendiente_pago' y NO va a cocina: la comanda sale cuando
//      el cajero confirme el pago (HU11);
//    - contra entrega queda en 'recibido' y la comanda entra de una vez en la cola de cocina.
// 4. Registra el historial del pedido y del domicilio. Si algo falla, no queda nada a medias.
async function crear({ canal, cliente, items, metodoPago, observaciones, registradoPor = null }) {
  const lineas = agrupar(items);
  return enTransaccion(async (conexion) => {
    const porId = await productosDisponibles(conexion, lineas);
    const subtotal = lineas.reduce((s, l) => s + porId.get(l.productoId).precio * l.cantidad, 0);
    const valorEnvio = negocio.valorEnvio;

    // LAST_INSERT_ID(id) hace que insertId sea el id del cliente también cuando ya existía
    const [c] = await conexion.query(
      `INSERT INTO cliente
         (nombre, telefono, direccion, barrio, referencia,
          autoriza_datos, autorizacion_fecha, autorizacion_medio)
       VALUES (?, ?, ?, ?, ?, TRUE, NOW(), ?)
       ON DUPLICATE KEY UPDATE
         id = LAST_INSERT_ID(id),
         nombre = VALUES(nombre),
         direccion = VALUES(direccion),
         barrio = VALUES(barrio),
         referencia = VALUES(referencia),
         autoriza_datos = TRUE,
         autorizacion_fecha = NOW(),
         autorizacion_medio = VALUES(autorizacion_medio)`,
      [
        cliente.nombre,
        cliente.telefono,
        cliente.direccion,
        cliente.barrio,
        cliente.referencia,
        MEDIO_AUTORIZACION[canal],
      ],
    );
    const clienteId = c.insertId;

    const [p] = await conexion.query(
      `INSERT INTO pedido (canal, subtotal, observaciones) VALUES ('domicilio', ?, ?)`,
      [subtotal, observaciones],
    );
    const pedidoId = p.insertId;
    for (const l of lineas) {
      await conexion.query(
        `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario, nota)
         VALUES (?, ?, ?, ?, ?)`,
        [pedidoId, l.productoId, l.cantidad, porId.get(l.productoId).precio, l.nota],
      );
    }

    const estado = metodoPago === 'transferencia' ? 'pendiente_pago' : 'recibido';
    const [d] = await conexion.query(
      `INSERT INTO domicilio
         (pedido_id, cliente_id, canal, metodo_pago, estado, direccion_entrega,
          valor_envio, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pedidoId,
        clienteId,
        canal,
        metodoPago,
        estado,
        cliente.direccion,
        valorEnvio,
        registradoPor,
      ],
    );

    const origen = canal === 'web' ? 'formulario web' : 'llamada o WhatsApp';
    await registrarHistorial(conexion, pedidoId, 'crear', registradoPor, {
      nuevo: `Domicilio por ${origen} · ${lineas.length} productos · $${subtotal}`,
    });
    await conexion.query(
      `INSERT INTO historial_cambio (entidad, entidad_id, accion, valor_nuevo, usuario_id)
       VALUES ('domicilio', ?, 'crear', ?, ?)`,
      [d.insertId, estado, registradoPor],
    );

    const pedido = await leer(conexion, pedidoId);
    if (estado === 'recibido') {
      await encolarImpresion(conexion, 'comanda', pedidoId, pedido.comanda, registradoPor);
    }

    return {
      pedidoId,
      domicilioId: d.insertId,
      canal,
      estado,
      metodoPago,
      creadoEn: pedido.creado_en,
      items: pedido.items.map((i) => ({
        nombre: i.nombre,
        cantidad: i.cantidad,
        nota: i.nota,
        precioUnitario: i.precio_unitario,
        total: i.total,
      })),
      subtotal,
      valorEnvio,
      total: subtotal + valorEnvio,
      // Si paga por transferencia, el cliente necesita a dónde consignar y a dónde mandar
      // el comprobante. El pedido no se prepara hasta que el cajero confirme el pago (HU11).
      pago:
        metodoPago === 'transferencia'
          ? { ...negocio.transferencia, whatsapp: negocio.whatsapp }
          : null,
    };
  });
}

// Lo que necesita el formulario público antes de pedir: la carta que se puede pedir hoy,
// agrupada por categoría y en el orden de la carta impresa, y los datos del envío y del pago.
// Solo datos públicos: nada de ids de usuarios ni estados internos.
function cartaPublica(productos) {
  const categorias = [];
  const porCategoria = new Map();
  for (const p of productos) {
    if (!porCategoria.has(p.categoria_id)) {
      const categoria = { id: p.categoria_id, nombre: p.categoria_nombre, productos: [] };
      porCategoria.set(p.categoria_id, categoria);
      categorias.push(categoria);
    }
    porCategoria.get(p.categoria_id).productos.push({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
    });
  }
  return {
    categorias,
    valorEnvio: negocio.valorEnvio,
    whatsapp: negocio.whatsapp,
    transferencia: negocio.transferencia,
  };
}

module.exports = { crear, cartaPublica };
