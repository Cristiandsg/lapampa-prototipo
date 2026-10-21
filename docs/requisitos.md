# Matriz de requisitos

Igual a la Tabla 2 del trabajo de grado y a la sección 4 del documento de Scrum. A = alta, M = media, B = baja.

| ID | Tipo | Requisito | Fuente | Prioridad | HU | Criterio de aceptación |
|---|---|---|---|---|---|---|
| RF01 | RF | Autenticar usuarios y restringir funciones según el rol | Observación; normativa (Ley 1581 de 2012) | Alta | HU01 | Cada rol accede solo a las funciones de su perfil; un intento de acceso no permitido es rechazado. |
| RF02 | RF | Gestionar el catálogo de productos de la carta | Propietario | Alta | HU02 | Permite crear, modificar y desactivar productos; un producto desactivado no aparece en pedidos nuevos y se conserva en el histórico. |
| RF03 | RF | Crear, renombrar y eliminar mesas con un nombre libre | Propietario; observación | Alta | HU03 | No pueden existir dos mesas activas con el mismo nombre y una mesa con pedido abierto no se puede eliminar. |
| RF04 | RF | Registrar un pedido asociado a una mesa | Observación | Alta | HU04 | El pedido se guarda con la mesa, los productos, las cantidades, el mesero y la hora; no se abre un segundo pedido en una mesa ocupada. |
| RF05 | RF | Modificar los productos de un pedido activo | Observación | Alta | HU05 | Solo se modifican pedidos activos; el total se recalcula y queda registrado el usuario que hizo el cambio. |
| RF06 | RF | Cerrar el pedido y generar la cuenta de la mesa | Observación | Alta | HU06 | La cuenta muestra el detalle y el total del pedido, y la mesa pasa a «por cobrar». |
| RF07 | RF | Registrar el pago con uno o dos medios (efectivo, tarjeta o transferencia) | Observación | Alta | HU07 | El pago y el cierre de la venta se guardan en una sola transacción: se registran ambos o ninguno. |
| RF08 | RF | Calcular y registrar la propina voluntaria | Propietario; normativa (Ley 1935 de 2018) | Media | HU08 | La propina se registra separada del valor de la venta y solo cuando el cliente la acepta. |
| RF09 | RF | Recibir pedidos a domicilio en un formulario web público, con autorización de tratamiento de datos y método de pago | Propietario; normativa (Ley 1581 de 2012; Decreto 1377 de 2013) | Alta | HU09 | No se envía un pedido sin la autorización marcada; un pedido con pago por transferencia queda en «pendiente de pago». |
| RF10 | RF | Registrar los domicilios recibidos por llamada o WhatsApp | Propietario | Alta | HU10 | Cada domicilio queda marcado con su canal (web o teléfono/WhatsApp). |
| RF11 | RF | Actualizar el estado de los domicilios y confirmar los pagos por transferencia | Propietario | Alta | HU11 | El pedido avanza por los estados recibido, en preparación, en camino y entregado, con la hora de cada cambio; sin pago confirmado no pasa a preparación. |
| RF12 | RF | Visualizar el estado de todas las mesas | Propietario | Media | HU12 | El estado de cada mesa (libre, ocupada, por cobrar) se actualiza en máximo 15 segundos. |
| RF13 | RF | Generar reportes de ventas y propinas por período | Propietario | Alta | HU13 | El total del reporte coincide con la suma de las ventas registradas en el período. |
| RF14 | RF | Consultar los productos más vendidos | Propietario | Media | HU14 | El reporte ordena los productos por cantidad vendida en el período seleccionado. |
| RF15 | RF | Comparar las ventas del canal mesa y del canal domicilio | Propietario | Baja | HU15 | El reporte muestra el total y el porcentaje de cada canal; la suma de ambos es igual al total del período. |
| RF16 | RF | Imprimir las comandas en la impresora de cocina y la cuenta y el comprobante en la de caja | Observación (dos impresoras térmicas en el local) | Alta | HU16 | La comanda sale en menos de 5 segundos y ningún trabajo de impresión se pierde ni se duplica. |
| RNF01 | RNF | Cierre de caja en menos de cinco minutos | Propietario (línea base observada: aprox. 30 min) | Alta | HU07, HU13 | Medido por cronometría con el propietario, el cierre de caja de una jornada se completa en menos de 5 minutos. |
| RNF02 | RNF | Almacenamiento seguro de contraseñas | Normativa (Ley 1581 de 2012, principio de seguridad) | Alta | HU01 | Ninguna contraseña se almacena en texto plano; se guardan mediante una función hash. |
| RNF03 | RNF | Integridad de las operaciones de venta | Observación (errores de cobro) | Alta | HU06, HU07 | Ante una falla simulada en medio de la operación, no quedan registros parciales de la venta. |
| RNF04 | RNF | Tiempo de respuesta de los reportes | Meta técnica del equipo | Media | HU13, HU14 | El reporte de ventas de un mes de operación se genera en menos de 5 segundos. |
| RNF05 | RNF | Accesibilidad de las interfaces en el celular | Normativa (NTC 5854) | Media | Todas | Las pantallas cumplen los criterios de nivel A de la NTC 5854 y se usan desde un celular (etiquetas en formularios, contraste suficiente y botones de al menos 48 px). |
| RNF06 | RNF | Registro simultáneo de pedidos | Observación (atención simultánea de mesas) | Media | HU04, HU05 | Con al menos tres celulares registrando pedidos al mismo tiempo, no se pierden ni se duplican registros. |
| RNF07 | RNF | Acceso web en la nube | Propietario (domicilios desde la casa del cliente) | Alta | HU09 | El sistema se usa desde el navegador sin instalar aplicaciones y el formulario de domicilio abre con HTTPS desde un celular fuera del local. |
| RNF08 | RNF | Privacidad de los datos de los clientes | Normativa (Ley 1581 de 2012) | Alta | HU09, HU11 | Los datos de un cliente se pueden corregir o eliminar desde la interfaz cuando el titular lo solicita. |
