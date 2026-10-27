// Listar pedidos pendientes por cobrar (HU06)
const listarPorCobrar = async (req, res) => {
    try {
        const [pedidos] = await pool.query(
            `SELECT p.id, p.subtotal, p.canal, p.creado_en, 
                    m.nombre AS mesa, 
                    u.nombre AS mesero,
                    TIMESTAMPDIFF(MINUTE, p.creado_en, NOW()) AS minutos,
                    (SELECT COUNT(*) FROM detalle_pedido dp WHERE dp.pedido_id = p.id) AS productos
             FROM pedido p
             LEFT JOIN mesa m ON p.mesa_id = m.id
             LEFT JOIN usuario u ON p.mesero_id = u.id
             WHERE p.estado = 'pendiente'
             ORDER BY p.creado_en ASC`
        );

        return res.status(200).json(pedidos);
    } catch (error) {
        console.error('Error al listar pedidos por cobrar:', error);
        return res.status(500).json({ error: 'Error al consultar las cuentas por cobrar.' });
    }
};