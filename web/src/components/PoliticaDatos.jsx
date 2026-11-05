// HU09 — Texto de la autorización y la política de tratamiento de datos personales
// (Ley 1581 de 2012 y Decreto 1377 de 2013, hoy en el Decreto 1074 de 2015).
// BORRADOR: lo redactó el equipo y está pendiente de aprobación del propietario (ver
// docs/politica-datos.md). Si cambia aquí, se cambia también en ese documento.
// El formulario solo pide datos de contacto y entrega: ninguno es dato sensible.

export const TEXTO_AUTORIZACION =
  'Autorizo a La Pampa Gastro Bar a tratar mis datos personales (nombre, celular y dirección) para recibir, preparar y entregar mi pedido y para contactarme sobre él, según su política de tratamiento de datos.';

export default function PoliticaDatos({ whatsapp }) {
  return (
    <div className="politica">
      <p>
        <strong>Responsable:</strong> La Pampa Gastro Bar, barrio La Primavera, Cali. Contacto por
        WhatsApp al {whatsapp}.
      </p>
      <p>
        <strong>Qué datos pedimos:</strong> tu nombre, tu celular, la dirección de entrega y, si
        quieres, el barrio y una referencia para encontrar tu casa.
      </p>
      <p>
        <strong>Para qué los usamos:</strong> recibir, preparar y entregar tu pedido; llamarte o
        escribirte si hay alguna novedad con él; y recordar tus datos para que no tengas que
        escribirlos de nuevo la próxima vez. No los usamos para publicidad ni los vendemos o
        compartimos con terceros, salvo que una autoridad lo exija por ley.
      </p>
      <p>
        <strong>Tus derechos:</strong> conocer, actualizar y corregir tus datos; pedir prueba de
        esta autorización; saber cómo los hemos usado; revocar la autorización o pedir que los
        borremos cuando no exista un deber legal de conservarlos; y presentar quejas ante la
        Superintendencia de Industria y Comercio. Para ejercerlos, escríbenos al WhatsApp del local.
      </p>
      <p>
        <strong>Cómo los cuidamos:</strong> se guardan en el sistema de pedidos del local, al que
        solo entra el personal con usuario y contraseña, y la conexión va cifrada (HTTPS).
      </p>
      <p>
        Esta autorización es voluntaria, pero sin ella no podemos llevarte el pedido. Queda
        registrada la fecha y el medio en que la diste.
      </p>
    </div>
  );
}
