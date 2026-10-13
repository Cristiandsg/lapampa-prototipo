# La Pampa Gastrobar — Primer prototipo

Sistema de información web para la automatización de pedidos, ventas y domicilios en La Pampa Gastrobar (Cali). Trabajo de grado — Ingeniería de Sistemas, UNIAJC.

**Equipo:** Cristian David Silva Grueso (Product Owner, frontend) · Esteban Antonio Estrada Angulo (Scrum Master, backend) · Diana Carolina Dorado Ruano (base de datos y QA)

El sistema es **web y mobile-first**: meseros, cajero y propietario lo usan desde el navegador del celular, y los clientes piden domicilios desde su casa en un formulario público. Va publicado en la nube con HTTPS.

## Arquitectura

```
Celular (navegador)  ──►  /web  React + Vite  (Vista)
                               │  HTTP/JSON (Axios)
                               ▼
                         /api  Node.js + Express  (Controladores + Modelos, patrón MVC)
                               │  mysql2 (pool, transacciones)
                               ▼
                         MySQL 8  (base de datos "lapampa")
```

| Carpeta | Contenido |
|---|---|
| `api/src/routes` | Rutas REST, una por módulo (`/api/salud`, luego `/api/auth`, `/api/mesas`, …) |
| `api/src/controllers` | Reciben la petición, validan y responden |
| `api/src/models` | Consultas SQL y transacciones |
| `api/src/middlewares` | Errores, y en Sprint 1: token JWT y permisos por rol |
| `api/db` | `schema.sql` (tablas), `seed.sql` (datos iniciales), `datos_prueba.sql` (opcional) |
| `web/src/pages` | Pantallas |
| `web/src/services` | Llamadas a la API |
| `docs/bd` | [MER](docs/bd/mer.md) y [diccionario de datos](docs/bd/diccionario.md) |

## Requisitos

- Node.js 20 o superior (`node -v`)
- MySQL 8 (o XAMPP/MariaDB para desarrollo)
- Git

## Instalación (primera vez)

```bash
git clone https://github.com/<usuario>/<repo>.git
cd <repo>
npm run instalar                 # instala la raíz, /api y /web

cp api/.env.example api/.env     # en Windows: copy api\.env.example api\.env
# editar api/.env con el usuario y la contraseña de MySQL

npm run db:prueba --prefix api   # crea la base "lapampa" con la carta real y 3 mesas de ejemplo
#  (o: npm run db:init --prefix api   -> carta real y usuarios, sin mesas)

npm run dev                      # levanta API (puerto 3000) y web (puerto 5173)
```

Abrir http://localhost:5173: debe decir **API funcionando** y **Base de datos conectada**.

**Probar desde el celular:** con el celular en la misma red Wi-Fi, abrir la dirección "Network" que muestra Vite (por ejemplo, `http://192.168.1.20:5173`).

**Usuarios de prueba** (contraseña `LaPampa2026*`): `propietario`, `cajero`, `mesero`. Se cambian antes de usar el sistema en el local.

> ⚠️ `db:init` y `db:prueba` **borran** la base `lapampa` y la crean de nuevo.

## Estilo visual

Tomado de la carta de La Pampa: mostaza `#E8B95E`, crema `#EFE6BD`, café `#4A3418`, títulos en **Playfair Display Black** y textos en **Montserrat** (servidas desde el proyecto con @fontsource). Las listas de productos usan los puntos guía de la carta (`Chumblún ..... $23.000`). La guía viva está en http://localhost:5173/estilo y las variables en `web/src/index.css`.

## Comandos

| Comando (desde la raíz) | Qué hace |
|---|---|
| `npm run dev` | API + web en modo desarrollo |
| `npm test` | Pruebas de la API (Jest + Supertest) y de la web (Vitest) |
| `npm run lint` | Revisa el código con ESLint |
| `npm run format` | Formatea con Prettier |

## Convenciones de trabajo

- **Ramas:** `main` (solo lo aceptado por el PO en el Review) · `develop` (integración) · `feature/HUxx-descripcion` (una por historia, creada desde `develop`). Ejemplo: `feature/HU03-crear-mesas`.
- **Commits:** empiezan con el ID de la historia: `HU03: valida nombre de mesa repetido`.
- **Pull Requests:** a `develop`, con revisión de otro integrante antes de integrar.
- **Versiones:** al cerrar cada sprint se etiqueta `v0.1`, `v0.2`, `v0.3` y `v1.0`, y se publica en la nube.
- **Backlog:** en Jira. El ID de la historia (HU01–HU15) va en la rama, el commit y el PR.
- Paso a paso del flujo con Git y VS Code: [docs/guia-git.md](docs/guia-git.md).

## Despliegue en la nube

El formulario de domicilios debe abrirse desde la casa del cliente, por eso el sistema se publica en internet:

| Parte | Servicio sugerido | Configuración |
|---|---|---|
| Base de datos | Railway (MySQL) o Aiven (MySQL) | Crear la base y correr `schema.sql` + `seed.sql` |
| API | Render o Railway | Raíz `api`, comando `npm start`, variables del `.env` (DB_*, JWT_SECRET, CORS_ORIGEN = URL del frontend) |
| Web | Vercel | Raíz `web`, framework Vite, variable `VITE_API_URL` = URL pública de la API |

Criterio de HT-01: la URL pública responde `GET /api/salud` con HTTPS desde un celular con datos móviles.

## Estado

**Sprint 0** — HT-01 (estructura del repositorio) y HT-02 (modelo de datos) listas para revisión. Pendiente: despliegue en la nube y HT-03 (mockups y línea base).
