const pool = require('../config/db');

// Registrar pagos de un pedido (Efectivo, tarjeta, transferencia, pago mixto)
const registrarPago = async (req, res) => {
    const { id: pedidoId } = req.params;
    const { pagos, cajeroId } = req.body; 

    if (!pagos || !Array.isArray(pagos) || pagos.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar al menos un medio de pago.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verificar si el pedido existe
        const [pedidos] = await connection.query('SELECT * FROM pedido WHERE id = ?', [pedidoId]);
        if (pedidos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        const pedido = pedidos[0];

        // 2. Obtener propina si la hay
        const [propinas] = await connection.query('SELECT valor FROM propina WHERE pedido_id = ?', [pedidoId]);
        const valorPropina = propinas.length > 0 ? Number(propinas[0].valor) : 0;
        const totalAPagar = Number(pedido.subtotal) + valorPropina;

        // 3. Sumar los pagos ingresados
        const sumaPagos = pagos.reduce((acc, p) => acc + Number(p.valor), 0);

        // 4. Validar que la suma sea exacta (Criterio de aceptación HU07)
        if (Math.abs(sumaPagos - totalAPagar) > 0.01) {
            await connection.rollback();
            return res.status(400).json({ 
                error: `El monto total de los pagos ($${sumaPagos}) no coincide con el total requerido ($${totalAPagar}).` 
            });
        }

        // 5. Insertar cada pago
        for (const pago of pagos) {
            await connection.query(
                `INSERT INTO pago (pedido_id, medio, valor, referencia, cajero_id) VALUES (?, ?, ?, ?, ?)`,
                [pedidoId, pago.medio, pago.valor, pago.referencia || null, cajeroId]
            );
        }

        // 6. Actualizar pedido a pagado
        await connection.query(
            `UPDATE pedido SET estado = 'pagado', pagado_en = NOW() WHERE id = ?`,
            [pedidoId]
        );

        await connection.commit();
        return res.status(201).json({ success: true, message: 'Pago registrado exitosamente.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar pago:', error);
        return res.status(500).json({ error: 'Error interno al procesar el pago.' });
    } finally {
        connection.release();
    }
};

// Consultar cierre de caja
const obtenerCierreCaja = async (req, res) => {
    try {
        const { fecha } = req.query;
        // Lógica básica de cierre de caja por fecha
        return res.status(200).json({ success: true, mensaje: 'Cierre de caja consultado correctamente', fecha: fecha || 'hoy' });
    } catch (error) {
        console.error('Error en cierre de caja:', error);
        return res.status(500).json({ error: 'Error al consultar el cierre de caja.' });
    }
};

module.exports = {
    registrarPago,
    obtenerCierreCaja
};