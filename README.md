# Web CADPO

Plataforma web para la administración y publicación de campeonatos de sim racing de CADPO. El repositorio contiene el sitio público, una API REST, un panel administrativo y una aplicación de escritorio para importar pilotos y resultados en forma masiva.

[English version](#english)

## Español

### Funcionalidades

- Campeonatos, categorías, calendarios y próximas fechas.
- Inscripciones, pilotos, autos, marcas y circuitos.
- Resultados, posiciones de campeonato y estadísticas.
- Consulta de tiempos en vivo desde un servidor externo.
- Panel administrativo para gestionar el contenido.
- Carga de imágenes, logos y reglamentos PDF.
- Importador de escritorio para cargas masivas en MySQL.
- Pantalla automática de mantenimiento cuando la API o la base de datos no están disponibles.

### Tecnologías

| Componente | Tecnologías |
| --- | --- |
| Frontend | React 19, React Router, Vite 8, Tailwind CSS, Axios |
| Backend | Node.js, Express 5, MySQL2, Multer, express-validator |
| Importador | Python 3, Tkinter, tksheet, MySQL Connector/Python |
| Base de datos | MySQL |

### Estructura del repositorio

```text
web_cadpo/
├── backend/             # API REST, acceso a MySQL y archivos multimedia
│   ├── scripts/         # Migraciones manuales de datos/esquema
│   └── src/
│       ├── config/      # Configuración de base de datos
│       ├── controllers/ # Lógica de los endpoints
│       ├── middleware/  # Errores y carga de archivos
│       ├── routes/      # Rutas de la API
│       └── utils/
├── frontend/            # Aplicación web React
│   ├── public/          # Recursos públicos y multimedia
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/    # Cliente HTTP de la API
│       └── utils/
└── importador_cadpo/   # Importador masivo de escritorio
```

### Requisitos

- Node.js compatible con Vite 8 (se recomienda una versión LTS vigente).
- npm.
- MySQL con el esquema de CADPO ya creado.
- Python 3.10 o posterior, solamente para usar el importador.

> El repositorio no incluye actualmente un volcado completo del esquema MySQL. Para ejecutar todo desde cero se necesita una base compatible con las tablas utilizadas por la API.

### Instalación local

Cloná el repositorio:

```bash
git clone https://github.com/federicocabello/web_cadpo.git
cd web_cadpo
```

Instalá las dependencias del backend y del frontend:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Configuración del backend

Copiá `backend/.env.example` como `backend/.env` y completá los valores:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña
DB_NAME=web_cadpo

FRONTEND_URL=http://localhost:5173
```

Variables adicionales admitidas:

| Variable | Uso | Valor predeterminado |
| --- | --- | --- |
| `PUBLIC_DIR` | Directorio donde se leen y guardan los archivos públicos | `public_html` en hosting o `frontend/public` en local |
| `LIVE_TIMING_HOST` | Servidor externo de tiempos en vivo | `rh.servegame.com` |
| `VITE_API_TARGET` | Destino del proxy de Vite durante el desarrollo | `http://localhost:3000` |

No subas archivos `.env` ni credenciales al repositorio.

### Ejecución en desarrollo

Abrí dos terminales.

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Servicios locales:

- Web: `http://localhost:5173`
- API: `http://localhost:3000/api`
- Estado de la API: `http://localhost:3000/api/health`

Vite redirige las solicitudes `/api` al backend durante el desarrollo.

### Comandos disponibles

Backend:

```bash
npm start       # Inicia la API
npm run dev     # Inicia la API con recarga mediante nodemon
npm test        # Marcador actual; todavía no hay pruebas automatizadas
```

Frontend:

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción en frontend/dist
npm run lint     # Análisis estático con Oxlint
npm run preview  # Previsualiza el build de producción
```

### Importador de escritorio

El importador se encuentra en `importador_cadpo/` y se conecta directamente a MySQL.

```powershell
cd importador_cadpo
py -m pip install -r requirements.txt
py main.py
```

En Windows también se puede iniciar con `iniciar.bat`. La conexión admite estas variables de entorno:

- `CADPO_DB_HOST`
- `CADPO_DB_PORT`
- `CADPO_DB_USER`
- `CADPO_DB_PASSWORD`
- `CADPO_DB_NAME`

### API

La API expone recursos bajo `/api`:

- `/health`
- `/auth`
- `/events`
- `/championships`
- `/registrations`
- `/drivers`
- `/cars`
- `/car-brands`
- `/categories`
- `/circuits`
- `/results`
- `/media`
- `/live-timing`

Las operaciones de administración deben realizarse con precaución: varios endpoints crean, modifican y eliminan registros y archivos.

### Build y despliegue

Generá el frontend de producción:

```bash
cd frontend
npm run build
```

El backend busca recursos estáticos en este orden:

1. `public_html`, si existe (entorno de hosting).
2. `frontend/dist`, para una instalación local o convencional.

Las rutas que no pertenecen a `/api` utilizan `index.html` como fallback de la SPA. En producción configurá `NODE_ENV=production`, las credenciales MySQL, el origen permitido mediante `FRONTEND_URL` y, si corresponde, `PUBLIC_DIR` y `LIVE_TIMING_HOST`.

### Migraciones

`backend/scripts/` contiene migraciones puntuales. Revisalas y hacé una copia de seguridad antes de ejecutarlas:

- `migrateAutoBrands.sql`: normaliza las marcas de autos en una tabla relacionada.
- `migrateCountryCodes.js`: transforma nombres conocidos de países en códigos de dos letras.

Ejemplo para la migración de países, con `backend/.env` configurado:

```bash
cd backend
node scripts/migrateCountryCodes.js
```

### Flujo de trabajo con Git

Antes de comenzar:

```bash
git pull --ff-only origin main
```

Después de verificar los cambios:

```bash
git status
git add <archivos>
git commit -m "descripción del cambio"
git push origin main
```

### Mantenimiento de este README

Actualizá este archivo cuando cambien:

- requisitos o dependencias principales;
- variables de entorno;
- comandos de instalación, pruebas o despliegue;
- estructura del repositorio;
- rutas o funcionalidades principales;
- migraciones necesarias.

Mantené sincronizadas las secciones en español e inglés.

---

## English

Web platform for managing and publishing CADPO sim racing championships. The repository includes the public website, a REST API, an administration panel, and a desktop application for bulk driver and result imports.

### Features

- Championships, categories, calendars, and upcoming events.
- Registrations, drivers, cars, manufacturers, and circuits.
- Results, championship standings, and statistics.
- Live timing retrieved from an external server.
- Administration panel for content management.
- Image, logo, and PDF regulation uploads.
- Desktop importer for bulk MySQL operations.
- Automatic maintenance screen when the API or database is unavailable.

### Technology stack

| Component | Technologies |
| --- | --- |
| Frontend | React 19, React Router, Vite 8, Tailwind CSS, Axios |
| Backend | Node.js, Express 5, MySQL2, Multer, express-validator |
| Importer | Python 3, Tkinter, tksheet, MySQL Connector/Python |
| Database | MySQL |

### Repository structure

```text
web_cadpo/
├── backend/             # REST API, MySQL access, and media handling
│   ├── scripts/         # Manual data/schema migrations
│   └── src/
│       ├── config/      # Database configuration
│       ├── controllers/ # Endpoint logic
│       ├── middleware/  # Error and upload middleware
│       ├── routes/      # API routes
│       └── utils/
├── frontend/            # React web application
│   ├── public/          # Public assets and media
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/    # API HTTP client
│       └── utils/
└── importador_cadpo/   # Desktop bulk importer
```

### Requirements

- A Node.js version compatible with Vite 8 (a current LTS release is recommended).
- npm.
- MySQL with the CADPO schema already created.
- Python 3.10 or newer, only if the desktop importer is required.

> The repository does not currently contain a complete MySQL schema dump. A compatible database containing the tables used by the API is required for a clean installation.

### Local installation

Clone the repository:

```bash
git clone https://github.com/federicocabello/web_cadpo.git
cd web_cadpo
```

Install backend and frontend dependencies:

```bash
cd backend
npm install

cd ../frontend
npm install
```

### Backend configuration

Copy `backend/.env.example` to `backend/.env` and fill in the values:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=web_cadpo

FRONTEND_URL=http://localhost:5173
```

Additional supported variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PUBLIC_DIR` | Directory used to read and store public files | `public_html` on hosting or `frontend/public` locally |
| `LIVE_TIMING_HOST` | External live timing server | `rh.servegame.com` |
| `VITE_API_TARGET` | Vite proxy target during development | `http://localhost:3000` |

Never commit `.env` files or credentials.

### Development

Open two terminals.

Backend:

```bash
cd backend
npm run dev
```

Frontend:

```bash
cd frontend
npm run dev
```

Local services:

- Web application: `http://localhost:5173`
- API: `http://localhost:3000/api`
- API health check: `http://localhost:3000/api/health`

Vite proxies `/api` requests to the backend during development.

### Available commands

Backend:

```bash
npm start       # Start the API
npm run dev     # Start the API with nodemon reloads
npm test        # Current placeholder; automated tests are not configured yet
```

Frontend:

```bash
npm run dev      # Start the development server
npm run build    # Create a production build in frontend/dist
npm run lint     # Run Oxlint
npm run preview  # Preview the production build
```

### Desktop importer

The importer is located in `importador_cadpo/` and connects directly to MySQL.

```powershell
cd importador_cadpo
py -m pip install -r requirements.txt
py main.py
```

On Windows it can also be launched with `iniciar.bat`. Its connection supports the following environment variables:

- `CADPO_DB_HOST`
- `CADPO_DB_PORT`
- `CADPO_DB_USER`
- `CADPO_DB_PASSWORD`
- `CADPO_DB_NAME`

### API

The API exposes these resources under `/api`:

- `/health`
- `/auth`
- `/events`
- `/championships`
- `/registrations`
- `/drivers`
- `/cars`
- `/car-brands`
- `/categories`
- `/circuits`
- `/results`
- `/media`
- `/live-timing`

Administrative operations should be used carefully: several endpoints create, modify, and delete database records and files.

### Production build and deployment

Build the frontend:

```bash
cd frontend
npm run build
```

The backend searches for static files in this order:

1. `public_html`, when present (hosting environment).
2. `frontend/dist`, for a local or conventional deployment.

Non-`/api` routes fall back to `index.html` for client-side routing. In production, configure `NODE_ENV=production`, the MySQL credentials, the allowed origin through `FRONTEND_URL`, and `PUBLIC_DIR` or `LIVE_TIMING_HOST` when applicable.

### Migrations

`backend/scripts/` contains one-off migrations. Review them and back up the database before running them:

- `migrateAutoBrands.sql`: normalizes car manufacturers into a related table.
- `migrateCountryCodes.js`: converts known country names into two-letter codes.

Example for the country migration, after configuring `backend/.env`:

```bash
cd backend
node scripts/migrateCountryCodes.js
```

### Git workflow

Before starting work:

```bash
git pull --ff-only origin main
```

After reviewing the changes:

```bash
git status
git add <files>
git commit -m "describe the change"
git push origin main
```

### Maintaining this README

Update this document whenever any of the following changes:

- requirements or major dependencies;
- environment variables;
- installation, testing, or deployment commands;
- repository structure;
- main routes or features;
- required migrations.

Keep the Spanish and English sections synchronized.

## License

No repository-wide license has been declared. All rights remain with the project owner unless a license file is added.
