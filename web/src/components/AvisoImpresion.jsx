import { useEffect, useState } from 'react';
import { estadoImpresion } from '../services/api';

const REFRESCO_MS = 15000;
// Una tirilla normal sale en menos de 5 segundos: si lleva más de esto, algo pasa
const ESPERA_NORMAL_S = 30;
const NOMBRE = { cocina: 'cocina', caja: 'caja' };

// Qué decirle al personal de una impresora, o null si todo va bien
export function avisoDe(nombre, e) {
  const esperando = e.pendientes + e.conError;
  const plural = esperando === 1 ? '1 tirilla esperando' : `${esperando} tirillas esperando`;
  if (e.conError > 0) {
    return `La impresora de ${NOMBRE[nombre]} no está imprimiendo: ${e.ultimoError ?? 'error desconocido'}. Hay ${plural}; salen solas cuando se arregle.`;
  }
  if (e.pendientes > 0 && e.segundosEsperando > ESPERA_NORMAL_S) {
    return e.agenteConectado
      ? `La impresora de ${NOMBRE[nombre]} va lenta: hay ${plural}.`
      : `La impresora de ${NOMBRE[nombre]} no está conectada al sistema: hay ${plural}. Revisa que el PC de la caja esté prendido con el agente de impresión abierto.`;
  }
  return null;
}

// HU16 — Aviso en pantalla cuando una impresión falla o se queda esperando.
// Si no se puede consultar el estado, no muestra nada (no estorba el trabajo).
export default function AvisoImpresion() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    let vigente = true;
    async function consultar() {
      try {
        const datos = await estadoImpresion();
        if (vigente) setEstado(datos);
      } catch {
        if (vigente) setEstado(null);
      }
    }
    consultar();
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible') consultar();
    }, REFRESCO_MS);
    return () => {
      vigente = false;
      clearInterval(intervalo);
    };
  }, []);

  const avisos = estado
    ? Object.entries(estado)
        .map(([nombre, e]) => avisoDe(nombre, e))
        .filter(Boolean)
    : [];
  if (avisos.length === 0) return null;
  return (
    <div className="avisos-impresion" role="alert">
      {avisos.map((a) => (
        <p key={a} className="alerta">
          {a}
        </p>
      ))}
    </div>
  );
}
