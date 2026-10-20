# Despliegue en la nube (HT-01)

El prototipo se publica en tres servicios con plan gratuito, sin tarjeta de crédito:

| Parte | Servicio | Qué queda |
|---|---|---|
| Base de datos | **Aiven** (MySQL 8, plan Free) | 1 GB de disco y conexión con SSL |
| API (`/api`) | **Render** (Web Service, plan Free) | `https://lapampa-api.onrender.com/api/salud` |
| Web (`/web`) | **Vercel** (plan Hobby) | `https://<proyecto>.vercel.app` con HTTPS |

Límites a tener en cuenta en las demos:

- **Render se duerme** después de 15 minutos sin visitas, y la primera petición tarda cerca de **un minuto** en despertarlo. Antes de una revisión con el propietario, abre la URL de la API un minuto antes. En el Sprint 3, el agente de impresión consulta la API cada 3 s y la mantiene despierta mientras el local esté abierto (750 horas gratis al mes alcanzan para un servicio encendido todo el mes).
- **Aiven apaga** el servicio gratuito si pasa mucho tiempo sin uso; avisa por correo antes, y se vuelve a encender desde la consola.
- Los usuarios de prueba (`LaPampa2026*`) están en el repositorio público. **Antes de cargar datos reales del local**, se cambian las contraseñas (HU01 trae la gestión de usuarios).

## 1. Base de datos en Aiven

1. Crear cuenta en [aiven.io](https://aiven.io) (se puede con GitHub).
2. **Create service → MySQL → plan Free**. Nombre: `mysql-lapampa`. Región: la más cercana disponible en EE. UU.
3. Esperar a que diga **Running**. En **Overview → Connection information** quedan: Host, Port, User (`avnadmin`), Password, y el botón para descargar el **CA certificate**.
4. En el PC, copiar `api/.env.nube.example` como `api/.env.nube` y llenarlo con esos datos.
   - `DB_SSL_CA`: abrir el `ca.pem` descargado y pegarlo en una sola línea, con `\n` donde van los saltos. Este comando de PowerShell lo deja copiado en el portapapeles:
     ```powershell
     (Get-Content ca.pem -Raw).Trim() -replace "`r?`n", '\n' | Set-Clipboard
     ```
5. Crear las tablas y la carta en la nube:
   ```bash
   npm run db:nube --prefix api
   ```
   Debe terminar en **Base de datos lista.** (Borra y crea la base `lapampa` de la nube; no toca la local.)

## 2. API en Render

1. Crear cuenta en [render.com](https://render.com) con GitHub y darle acceso al repositorio.
2. **New → Blueprint →** elegir el repositorio. Render lee `render.yaml` y propone el servicio `lapampa-api` (rama `develop`, carpeta `api`, plan Free).
3. Llenar las variables que pide: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_SSL_CA` (las mismas de `api/.env.nube`) y `CORS_ORIGEN` (por ahora `http://localhost:5173`; se completa en el paso 4). `JWT_SECRET` lo genera Render.
4. **Apply.** Cuando el deploy diga **Live**, abrir la URL del servicio (arriba a la izquierda; por ejemplo `https://lapampa-api.onrender.com`, o con letras al final si ese nombre ya estaba ocupado) agregándole `/api/salud`: debe responder `"baseDeDatos": "conectada"`.

## 3. Web en Vercel

1. Crear cuenta en [vercel.com](https://vercel.com) con GitHub.
2. **Add New → Project →** importar el repositorio.
3. **Root Directory:** `web` (Vercel detecta Vite). **Production Branch:** `develop` (en Settings → Git, después del primer deploy).
4. **Environment Variables:** `VITE_API_URL` = `https://lapampa-api.onrender.com` (sin `/api` al final).
5. **Deploy.** Copiar la URL que entrega (por ejemplo, `https://lapampa.vercel.app`).

## 4. Conectar web y API

1. En Render → `lapampa-api` → **Environment**, cambiar `CORS_ORIGEN` a:
   `https://lapampa.vercel.app,http://localhost:5173` (con la URL real de Vercel). Guardar; Render redespliega solo.
2. Abrir la URL de Vercel **desde un celular con datos móviles** (sin Wi-Fi): debe decir **API funcionando** y **Base de datos conectada**. Si tarda, es Render despertando.
3. Poner las dos URL en el README (sección "En la nube") y tomar la captura para Jira (criterio de aceptación de HT-01).

## Después

Cada vez que se integra un PR a `develop`, Render y Vercel vuelven a publicar solos. Si un cambio toca `schema.sql` o `seed.sql`, hay que correr otra vez `npm run db:nube --prefix api` (borra los datos de la nube).
