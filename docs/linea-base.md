# Línea base de la operación actual (HT-03)

Cómo trabaja hoy La Pampa Gastrobar **sin el sistema**. Es el punto de partida contra el que se compara el prototipo en el Sprint 4 (HU15 y prueba de aceptación con el propietario).

- **Documentado:** 21 de octubre de 2026, Sprint 0.
- **Método:** observación participante. Cristian David Silva Grueso trabajó como mesero en el establecimiento y vio de primera mano la toma de pedidos, el cobro y el cierre de caja. El propietario confirmó los datos.
- **Mockups:** el propietario revisó y aprobó los mockups de las pantallas principales en octubre de 2026.

## Contexto de operación

- Hoy el local abre **sábados y domingos**. Los **jueves y viernes** abre solo con reserva.
- La carga cambia mucho de un día a otro: hay días suaves y días con eventos o reservas grandes.
- Los pedidos por mesa se anotan en papel (comanda) y el control de ventas se lleva en Excel.
- No hay canal propio de domicilios.

## Datos de partida

| Indicador | Situación actual | Fuente |
|---|---|---|
| Pedidos por jornada | Cerca de **50 pedidos** en días de eventos o reservas grandes, con **más de 50 productos** entre entradas, platos fuertes y bebidas. Menos en días suaves. | Observación participante, confirmada por el propietario |
| Fluidez del servicio | Con pocas mesas, la toma de pedidos funciona bien y rápido. Con **5 a 7 mesas ocupadas** se complica. | Observación participante |
| Errores de comanda y de cobro | Cerca de **1 de cada 10 jornadas**. Comandas en las que no queda claro a qué mesa van o qué se pidió, y platos que se omiten. | Observación participante y estimación del propietario |
| Tiempo de cierre de caja | Unos **30 minutos** cuando se hace: contar el dinero y conciliar los registros del día. | Observación participante, confirmada por el propietario |
| Forma del cierre de caja | Las **propinas se cuadran a mano**. En las últimas jornadas observadas **no se hizo cierre formal**: solo se comparan las facturas de pago con el dinero en caja, así que no se detectan faltantes ni sobrantes. | Observación participante |
| Mesas | Cerca de 10. No se precargan en el sistema: el mesero crea las mesas de cada jornada (HU03). | Conteo en la visita al local |

## Qué se espera con el sistema y cómo se compara en el Sprint 4

| Indicador | Meta con el sistema | Cómo se mide |
|---|---|---|
| Tiempo de cierre de caja | **Menos de 5 minutos** (RNF01): el sistema totaliza la jornada por medio de pago y deja las propinas aparte. | Cronometrar un cierre con el propietario usando el reporte del día (HU13). |
| Cierre de caja realizado | Se hace en todas las jornadas, porque los totales salen solos. | Revisar en el sistema que cada jornada tenga sus pagos registrados. |
| Propinas | Registradas en cada cobro, separadas de la venta (HU08), con total por jornada (HU13). | Comparar el total del reporte con lo que se reparte. |
| Errores de comanda | Cada pedido queda atado a su mesa y la comanda sale impresa en cocina (HU04, HU16). | Prueba de aceptación en una jornada con 5 o más mesas ocupadas. |
| Pedidos por jornada | Conteo exacto por canal (mesa y domicilio). | Reportes de HU13 y HU15. |

## Observación del equipo

El canal de domicilios (Sprint 3) puede ayudar a que el local venda también los días que hoy no abre, porque los clientes pueden pedir desde su casa. Se revisará con los datos de HU15 (comparativo mesa vs. domicilio).
