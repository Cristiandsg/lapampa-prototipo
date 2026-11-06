# Política de tratamiento de datos personales — domicilios (borrador)

> **Estado:** borrador redactado por el equipo el 5 de noviembre de 2026 para la HU09, **pendiente de aprobación del propietario** (lo confirma el PO). Se muestra en el formulario público `/pedir`. El texto vive en `web/src/components/PoliticaDatos.jsx`: si se cambia aquí, se cambia allá en el mismo commit.
>
> Base legal: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015). Antes de publicarlo como definitivo conviene completar los datos del responsable (razón social o nombre del propietario, NIT o cédula, dirección y un correo de contacto), que hoy no están en el sistema.

## Texto de la autorización (casilla obligatoria)

> Autorizo a La Pampa Gastro Bar a tratar mis datos personales (nombre, celular y dirección) para recibir, preparar y entregar mi pedido y para contactarme sobre él, según su política de tratamiento de datos.

Sin la casilla marcada el formulario no se envía y la API responde 400. El sistema guarda la fecha y el medio de la autorización (`cliente.autorizacion_fecha`, `cliente.autorizacion_medio`).

## Política (se despliega en el formulario)

**Responsable:** La Pampa Gastro Bar, barrio La Primavera, Cali. Contacto por WhatsApp al 319 565 4739.

**Qué datos pedimos:** nombre, celular, dirección de entrega y, si el cliente quiere, el barrio y una referencia para encontrar la casa. Ninguno es un dato sensible.

**Para qué los usamos:** recibir, preparar y entregar el pedido; llamar o escribir si hay alguna novedad con él; y recordar los datos para que no tenga que escribirlos de nuevo la próxima vez. No se usan para publicidad ni se venden o comparten con terceros, salvo que una autoridad lo exija por ley.

**Derechos del titular:** conocer, actualizar y corregir sus datos; pedir prueba de la autorización; saber cómo se han usado; revocar la autorización o pedir que se borren cuando no exista un deber legal de conservarlos; y presentar quejas ante la Superintendencia de Industria y Comercio. Se ejercen escribiendo al WhatsApp del local. (La corrección y eliminación desde la interfaz del cajero llega con HU11.)

**Seguridad:** los datos se guardan en el sistema de pedidos del local, al que solo entra el personal con usuario y contraseña, y la conexión va cifrada (HTTPS).

La autorización es voluntaria, pero sin ella no se puede hacer la entrega.
