# Sprint 2 — Caja y control de ventas (v0.3)

**Objetivo:** que cada venta quede registrada en el momento del cobro, con la propina aparte, para que el cierre de caja pase a ser una consulta.

**Resultado:** objetivo cumplido. Las 4 historias (21 puntos) están publicadas en https://lapampa-gastrobar.vercel.app, y el propietario aprobó el incremento en la revisión del sprint.

## Historias entregadas

| Historia | Puntos | Pull Request | Criterio de aceptación clave |
|---|---|---|---|
| HU05 Modificar un pedido activo | 5 | #16 | Quitar un producto ya enviado a cocina exige el motivo; un pedido cerrado no admite cambios |
| HU06 Cerrar el pedido y generar la cuenta | 5 | #17 | Al cerrar, la mesa pasa a "por cobrar" y aparece en la bandeja del cajero |
| HU07 Registrar el pago | 8 | #18 y #19 | Si la suma de los pagos no es igual al consumo más la propina, no se guarda; el cierre del día se consulta en menos de 5 segundos |
| HU08 Calcular y registrar la propina | 3 | #19 | La propina va separada del consumo y nunca se suma sin que el cajero confirme la respuesta del cliente |

## Evidencia técnica

- **Pruebas automáticas:** 186 de la API (Jest + Supertest) y 75 de la web (Vitest + Testing Library). Todas pasan y el lint queda sin errores.
- **Dinero en transacciones:** cobro, propina, pedido pagado y mesa libre van en una sola transacción. Una prueba simula una falla a mitad del cobro y comprueba que no queda nada registrado.
- **Concurrencia:**
  - dos cajeros cobrando el mismo pedido: un solo cobro;
  - dos celulares generando la misma cuenta: una sola cuenta;
  - dos celulares modificando el mismo pedido: no se pierde ningún cambio.
- **Trazabilidad:** cada cambio del pedido queda en el historial con quién lo hizo, cuándo y el motivo: agregar, cambiar, quitar, anular, generar la cuenta, reabrir y cobrar.
- **Ley 1935 de 2018:** la propina se sugiere del 10 %, la cuenta y el comprobante dicen que es voluntaria, y se liquida a cada mesero en el cierre de caja.

## Revisión del sprint (Sprint Review)

- **Participantes:** propietario de La Pampa y equipo de desarrollo.
- **Demostración:** desde el celular, en la versión publicada:
  1. pedido de mesa con una adición y un producto quitado con motivo;
  2. cuenta con vista previa;
  3. cobro con propina y pago mixto, con cálculo de vueltas;
  4. cierre de caja del día con las propinas por mesero.
- **Decisión:** el propietario **aprobó** el incremento. El flujo de mesero y de caja lo validó el Product Owner, que trabajó en el local como mesero y como cajero.
- **Medición pendiente:** cronometrar el cierre de caja de una jornada real con el sistema y compararlo con los 30 minutos de la línea base (subtarea de QA del Sprint 4).

## Retrospectiva

**Qué salió bien**
- Las historias se apoyaron en lo que ya existía: el bloqueo de mesa y pedido, el historial y la cola de impresión. La caja quedó completa en un solo sprint.
- Las pruebas de concurrencia encontraron un error real: al quitar el último producto mientras otro celular agregaba algo, el pedido se podía anular. Se corrigió antes de llegar al local.
- La cuenta y el comprobante ya quedan listos para la impresora de caja (HU16).

**Qué salió mal**
- La primera versión de HU07 se fusionó sin revisión y tenía errores de fondo: la mesa no se liberaba, se podía cobrar dos veces, el cajero estaba escrito a mano y el cierre salía en hora UTC.
- La rama de HU08 quedó subida sin Pull Request y no arrancaba.
- Al subir los cambios se pegaron comandos repetidos y parches viejos; se resolvió sin pérdidas.

**Qué vamos a mejorar en el Sprint 3**
- Cristian fusiona solo después de revisar y de que pasen `npm test` y `npm run lint`.
- El comando `/historia` obliga a leer `docs/forma-de-trabajo.md` (sección 7: errores que ya pasaron) y `docs/api.md` antes de programar.
- Después de cada `push` se abre el PR a `develop`; una rama sin PR no llega al programa.

## Siguiente sprint

Sprint 3 — Domicilios e impresión:
- HU09 formulario web de domicilio (Cristian / Esteban);
- HU10 domicilios por llamada o WhatsApp (Diana);
- HU11 seguimiento por estados (Esteban / Cristian);
- HU16 impresión en el local (Esteban / Diana).
