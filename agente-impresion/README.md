# Agente de impresión (HU16)

Programa pequeño en Node.js que corre en el **PC fijo de la caja**, donde están conectadas las dos impresoras térmicas (cocina y caja). Cada 3 segundos le pregunta a la API qué falta por imprimir, manda cada tirilla a su impresora en ESC/POS y confirma lo impreso.

```
Celular del mesero ──► API (Render) ──► cola trabajo_impresion
                                             ▲        │
                         PC de la caja: agente ◄──────┘ cada 3 s
                              │            │
                    impresora cocina   impresora caja
```

No tiene dependencias: solo necesita **Node.js 20 o más nuevo**.

## Reglas que cumple

- Una tirilla se marca *impresa* solo después de que la impresora la recibió.
- Si una impresora falla (apagada, sin papel, desconectada), el trabajo **queda en la cola con el error** y se reintenta cada 15 segundos. Mientras tanto, esa impresora no imprime nada más, para no desordenar las comandas. La otra impresora sigue funcionando. El personal ve el aviso en la pantalla del pedido y en Caja.
- Si la tirilla salió pero se cayó internet antes de confirmarla, el agente **no la vuelve a imprimir**: guarda el número en `impresas-sin-confirmar.json` y solo reintenta la confirmación, incluso si el PC se reinicia.
- Lo de caja dice "Cuenta" o "Comprobante de pago" y "Este documento no es factura".

## Instalar en el PC de la caja (Windows)

1. **Instalar Node.js 20 LTS** o más nuevo desde nodejs.org.
2. **Compartir cada impresora.** En *Configuración → Impresoras*, abre la impresora → *Propiedades de impresora → Compartir*. Marca *Compartir esta impresora* y ponle un nombre **sin espacios**: `Cocina` y `Caja`.
3. **Copiar la carpeta `agente-impresion`** del repositorio al PC, por ejemplo en `C:\LaPampa\agente-impresion`.
4. **Configurar.** Copia `.env.example` como `.env` en esa carpeta y llena:
   - `API_URL=https://lapampa-api.onrender.com/api`
   - `CLAVE_AGENTE=` la misma clave que se puso en Render como `CLAVE_AGENTE_IMPRESION` (mínimo 16 caracteres; pídesela a Cristian).
   - `IMPRESORA_COCINA=\\localhost\Cocina` y `IMPRESORA_CAJA=\\localhost\Caja`.
   - `CODIFICACION=cp1252` para Epson y compatibles. Si las tildes salen raras, prueba `cp850`.
5. **Probar.** Abre una terminal en la carpeta y corre `npm start`. Envía un pedido desde un celular: la comanda debe salir en menos de 5 segundos y en la terminal aparece `Impresa #… en cocina`.
6. **Que arranque solo.** Presiona `Win + R`, escribe `shell:startup` y pega ahí un acceso directo a `iniciar-agente.bat`.

Si las impresoras son de red (con cable Ethernet), en lugar del recurso compartido se usa su IP: `IMPRESORA_COCINA=tcp://192.168.1.50:9100`.

## Probar sin impresora

Con `IMPRESORA_COCINA=archivo:./tirillas` cada tirilla se guarda como archivo de texto en la carpeta `tirillas/`. Sirve para revisar el agente en cualquier computador.

```bash
npm test    # pruebas del agente (node:test, sin MySQL)
npm start   # inicia el agente con el .env de esta carpeta
```

## Si algo falla

| Mensaje en la terminal | Qué revisar |
|---|---|
| `Clave del agente de impresión inválida` | `CLAVE_AGENTE` no coincide con `CLAVE_AGENTE_IMPRESION` de Render |
| `La impresión no está configurada en el servidor` | Falta `CLAVE_AGENTE_IMPRESION` en Render |
| `No se pudo enviar a \\localhost\Cocina` | El nombre del recurso compartido o que la impresora esté instalada y compartida |
| `No se pudo consultar la cola` | Internet del local, o Render despertándose (la primera consulta puede tardar hasta un minuto) |

Con una impresora compartida de Windows, si la impresora está apagada **pero instalada**, Windows guarda la tirilla en su propia cola y la imprime al prenderla. En ese caso el sistema la ve como enviada.
