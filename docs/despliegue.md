# Despliegue en la nube (HT-01)

El prototipo se publica en tres servicios con plan gratuito, sin tarjeta de crédito:

| Parte | Servicio | Qué queda |
|---|---|---|
| Base de datos | **Aiven** (MySQL 8, plan Free) | 1 GB de disco y conexión con SSL |
| API (`/api`) | **Render** (Web Service, plan Free, región Oregon) | https://lapampa-api.onrender.com/api/salud |
| Web (`/web`) | **Vercel** (plan Hobby) | https://lapampa-gastrobar.vercel.app |

La base quedó en Aiven sobre DigitalOcean, región San Francisco (`sfo`); por eso la API va en Oregon, la región de Render más cercana. La rama por defecto del repositorio es `develop`: Render y Vercel publican desde ahí.

Límites a tener en cuenta en las demos:

- **Render se duerme** después de 15 minutos sin visitas, y la primera petición tarda cerca de **un minuto** en despertarlo. Antes de una revisión con el propietario, abre la URL de la API un minuto antes. En el Sprint 3, el agente de impresión consulta la API cada 3 s y la mantiene despierta mientras el local esté abierto (750 horas gratis al mes alcanzan para un servicio encendido todo el mes).
- **Aiven apaga** el servicio gratuito si pasa mucho tiempo sin uso; avisa por correo antes, y se vuelve a encender desde la consola.
- Los usuarios de prueba (`LaPampa2026*`) están en el repositorio público. **Antes de cargar datos reales del local**, se cambian las contraseñas (HU01 trae la gestión de usuarios).

## 1. Base de datos en Aiven

1. Crear cuenta en `console.aiven.io/signup` (se puede con Google o GitHub). No usar "Iniciar prueba": esa es la prueba de los planes pagos.
2. **Create service → MySQL → plan Free** ($0, sin tarjeta). El banner de "trial de 30 días" es para servicios pagos; el plan Free no vence.
3. Esperar a que diga **Running**. En **Overview → Connection information** quedan: Host, Port, User (`avnadmin`), Password, y el botón para descargar el **CA certificate**.
4. En el PC, copiar `api/.env.nube.example` como `api/.env.nube` y llenarlo con esos datos.
   - `DB_NAME` se deja en `lapampa` (no `defaultdb`): el script crea su propia base.
   - `DB_SSL_CA`: copiar el **CA certificate** con su icono de copiar y pegarlo **entre comillas**, con sus saltos de línea (ver el ejemplo dentro del archivo). Es obligatorio: sin él Aiven rechaza la conexión.
5. Crear las tablas y la carta en la nube:
   ```bash
   npm run db:nube --prefix api
   ```
   Debe terminar en **Base de datos lista.** (Borra y crea la base `lapampa` de la nube; no toca la local.)

## 2. API en Render

1. Crear cuenta en [render.com](https://render.com) con GitHub y darle acceso al repositorio.
2. **New → Blueprint →** elegir el repositorio. Render lee `render.yaml` y propone el servicio `lapampa-api` (rama `develop`, carpeta `api`, plan Free).
   - En **Branch** elegir `develop` (si sale `main`, dice "render.yaml not found").
3. Llenar las variables que pide: `DB_HOST`, `DB_PORT`, `DB_USER` (`avnadmin`), `DB_PASSWORD` y `DB_SSL_CA` (las mismas de `api/.env.nube`, pero el certificado **sin comillas**), y `CORS_ORIGEN` (por ahora `http://localhost:5173`; se completa en el paso 4). `JWT_SECRET` lo genera Render. Ningún valor debe tener espacios al principio o al final.
4. **Apply.** Cuando el deploy diga **Live**, abrir la URL del servicio (arriba a la izquierda; por ejemplo `https://lapampa-api.onrender.com`, o con letras al final si ese nombre ya estaba ocupado) agregándole `/api/salud`: debe responder `"baseDeDatos": "conectada"`.

## 3. Web en Vercel

1. Crear cuenta en [vercel.com](https://vercel.com) (plan Hobby) con GitHub.
2. **Add New → Project →** importar el repositorio. Toma la rama por defecto (`develop`).
3. **Project Name:** `lapampa-gastrobar` (es la dirección pública). **Root Directory:** `web`; el preset queda en **Vite**.
4. **Environment Variables:** `VITE_API_URL` = `https://lapampa-api.onrender.com` (sin `/api` al final).
5. **Deploy.** La página queda en https://lapampa-gastrobar.vercel.app. Mientras no se haga el paso 4, dice "API sin respuesta".

## 4. Conectar web y API

1. En Render → `lapampa-api` → **Environment**, cambiar `CORS_ORIGEN` a (sin espacios y sin `/` al final):
   `https://lapampa-gastrobar.vercel.app,http://localhost:5173`
   **Save Changes → Save, rebuild, and deploy** (si solo se da *Manual Deploy*, los cambios no se guardan).
2. Abrir la URL de Vercel **desde un celular con datos móviles** (sin Wi-Fi): debe decir **API funcionando** y **Base de datos conectada**. Si tarda, es Render despertando.
3. Tomar la captura para Jira (criterio de aceptación de HT-01).

## Si algo falla

`/api/salud` responde `"baseDeDatos": "sin conexión"` sin mostrar el motivo. El motivo queda en Render → **Logs**, en la línea `[salud] Sin conexión a MySQL: …`:

| Error en Logs | Qué revisar |
|---|---|
| `ER_ACCESS_DENIED_ERROR` | `DB_USER` debe ser `avnadmin` y `DB_PASSWORD` igual a la de Aiven, sin espacios. Probar primero desde el PC con `api/.env.nube`. |
| `ENOTFOUND` / `ETIMEDOUT` | `DB_HOST` y `DB_PORT`, y que el servicio de Aiven esté **Running** (pudo apagarse por inactividad). |
| `HANDSHAKE_SSL_ERROR` o algo con *certificate* | `DB_SSL=true` y `DB_SSL_CA` completo, sin comillas en Render. |

Si la contraseña de Aiven se expone (por ejemplo, en una captura), se cambia en Aiven con el botón ↻ junto a *Password* y se actualiza en `api/.env.nube` y en Render.

## Después

Cada vez que se integra un PR a `develop`, Render y Vercel vuelven a publicar solos. Si un cambio toca `schema.sql` o `seed.sql`, hay que correr otra vez `npm run db:nube --prefix api` (borra los datos de la nube).
