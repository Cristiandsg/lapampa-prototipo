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

// Consultar cierre de caja agrupado por medio de pago (PRU-79)
const obtenerCierreCaja = async (req, res) => {
    try {
        // Si no mandan fecha en la URL (?fecha=YYYY-MM-DD), tomamos la fecha actual del servidor
        const { fecha } = req.query;
        const fechaConsulta = fecha ? fecha : new Date().toISOString().slice(0, 10);

        // Consulta SQL optimizada para agrupar los pagos por medio y sumar sus valores en menos de 5 segundos
        const [totales] = await pool.query(
            `SELECT medio, SUM(valor) AS total_recaudado, COUNT(*) AS cantidad_transacciones 
             FROM pago 
             WHERE DATE(creado_en) = ? 
             GROUP BY medio`,
            [fechaConsulta]
        );

        // Calcular el gran total general del día
        const granTotal = totales.reduce((acc, curr) => acc + Number(curr.total_recaudado), 0);

        return res.status(200).json({
            success: true,
            fecha: fechaConsulta,
            totalesPorMedio: totales,
            granTotalRecaudado: granTotal
        });

    } catch (error) {
        console.error('Error al consultar el cierre de caja:', error);
        return res.status(500).json({ error: 'Error al consultar el cierre de caja.' });
    }
};

module.exports = {
    registrarPago,
    obtenerCierreCaja
};