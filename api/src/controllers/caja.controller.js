const pool = require('../config/db');

// Obtener detalles del pedido incluyendo propina sugerida (PRU-82)
const obtenerDetallePedidoParaCobro = async (req, res) => {
    const { id: pedidoId } = req.params;
    try {
        const [pedidos] = await pool.query(
            `SELECT p.*, u.nombre AS mesero_nombre 
             FROM pedido p 
             LEFT JOIN usuario u ON p.mesero_id = u.id 
             WHERE p.id = ?`,
            [pedidoId]
        );

        if (pedidos.length === 0) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }

        const pedido = pedidos[0];
        const subtotal = Number(pedido.subtotal) || 0;
        
        // Calcular la propina sugerida del 10% (Ley 1935 de 2018)
        const propinaSugerida = Math.round(subtotal * 0.10);

        return res.status(200).json({
            success: true,
            pedido: {
                ...pedido,
                propinaSugerida,
                totalConPropinaSugerida: subtotal + propinaSugerida
            }
        });
    } catch (error) {
        console.error('Error al obtener detalle del pedido:', error);
        return res.status(500).json({ error: 'Error al consultar el detalle del pedido.' });
    }
};

// Registrar pagos y propina (HU07 y HU08 / PRU-83)
const registrarPagoConPropina = async (req, res) => {
    const { id: pedidoId } = req.params;
    const { pagos, cajeroId, valorPropina } = req.body; 

    if (!pagos || !Array.isArray(pagos) || pagos.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar al menos un medio de pago.' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verificar si el pedido existe y obtener su mesero
        const [pedidos] = await connection.query('SELECT * FROM pedido WHERE id = ?', [pedidoId]);
        if (pedidos.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }
        const pedido = pedidos[0];

        // 2. Calcular total requerido (Subtotal + Propina decidida por el cliente)
        const subtotal = Number(pedido.subtotal);
        const propinaFinal = Number(valorPropina) || 0; // Puede ser aceptada, modificada o 0 (rechazada)
        const totalAPagar = subtotal + propinaFinal;

        // 3. Sumar los pagos ingresados
        const sumaPagos = pagos.reduce((acc, p) => acc + Number(p.valor), 0);

        // 4. Validar que la suma total sea exacta
        if (Math.abs(sumaPagos - totalAPagar) > 0.01) {
            await connection.rollback();
            return res.status(400).json({ 
                error: `El monto total de los pagos ($${sumaPagos}) no coincide con el total requerido ($${totalAPagar} que incluye consumo y propina).` 
            });
        }

        // 5. Registrar o actualizar la propina en la tabla correspondiente (PRU-83)
        // Verificamos si ya existe registro de propina para actualizarlo o insertarlo
        const [propinaExistente] = await connection.query('SELECT id FROM propina WHERE pedido_id = ?', [pedidoId]);
        if (propinaExistente.length > 0) {
            await connection.query(
                `UPDATE propina SET valor = ?, mesero_id = ? WHERE pedido_id = ?`,
                [propinaFinal, pedido.mesero_id, pedidoId]
            );
        } else {
            await connection.query(
                `INSERT INTO propina (pedido_id, valor, mesero_id) VALUES (?, ?, ?)`,
                [pedidoId, propinaFinal, pedido.mesero_id]
            );
        }

        // 6. Insertar cada pago en la tabla pago
        for (const pago of pagos) {
            await connection.query(
                `INSERT INTO pago (pedido_id, medio, valor, referencia, cajero_id) VALUES (?, ?, ?, ?, ?)`,
                [pedidoId, pago.medio, pago.valor, pago.referencia || null, cajeroId]
            );
        }

        // 7. Actualizar estado del pedido a pagado
        await connection.query(
            `UPDATE pedido SET estado = 'pagado', pagado_en = NOW() WHERE id = ?`,
            [pedidoId]
        );

        await connection.commit();
        return res.status(201).json({ success: true, message: 'Pago y propina registrados exitosamente.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar pago con propina:', error);
        return res.status(500).json({ error: 'Error interno al procesar el pago y la propina.' });
    } finally {
        connection.release();
    }
};

// Consultar cierre de caja agrupado por medio de pago (incluyendo desglose de propinas por mesero - PRU-85)
const obtenerCierreCaja = async (req, res) => {
    try {
        const { fecha } = req.query;
        const fechaConsulta = fecha ? fecha : new Date().toISOString().slice(0, 10);

        const [totales] = await pool.query(
            `SELECT medio, SUM(valor) AS total_recaudado, COUNT(*) AS cantidad_transacciones 
             FROM pago 
             WHERE DATE(creado_en) = ? 
             GROUP BY medio`,
            [fechaConsulta]
        );

        // Consultar total de propinas liquidadas por mesero en la jornada (PRU-85)
        const [propinasMeseros] = await pool.query(
            `SELECT u.nombre AS mesero, SUM(pr.valor) AS total_propina, COUNT(pr.id) AS cantidad_propinas
             FROM propina pr
             JOIN pedido p ON pr.pedido_id = p.id
             JOIN usuario u ON pr.mesero_id = u.id
             WHERE DATE(p.pagado_en) = ?
             GROUP BY pr.mesero_id, u.nombre`,
            [fechaConsulta]
        );

        const granTotalPagos = totales.reduce((acc, curr) => acc + Number(curr.total_recaudado), 0);
        const granTotalPropinas = propinasMeseros.reduce((acc, curr) => acc + Number(curr.total_propina), 0);

        return res.status(200).json({
            success: true,
            fecha: fechaConsulta,
            totalesPorMedio: totales,
            granTotalRecaudado: granTotalPagos,
            propinasPorMesero: propinasMeseros,
            granTotalPropinas
        });

    } catch (error) {
        console.error('Error al consultar el cierre de caja:', error);
        return res.status(500).json({ error: 'Error al consultar el cierre de caja.' });
    }
};

module.exports = {
    obtenerDetallePedidoParaCobro,
    registrarPagoConPropina,
    obtenerCierreCaja
};