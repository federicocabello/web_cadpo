# Web CADPO

Plataforma web para la administración y publicación de campeonatos de sim racing de CADPO. El repositorio contiene el sitio público, una API REST, un panel administrativo y una aplicación de escritorio para importar pilotos y resultados en forma masiva.

[English version](#english)

## Español

### Funcionalidades

- Campeonatos, categorías, calendarios y próximas fechas.
- Publicación programada de una o varias próximas fechas en el Inicio, administrable por fecha, y configuración explícita de transmisión en vivo por formulario de campeonato.
- Inscripciones, pilotos, autos, marcas y circuitos.
- Resultados, posiciones de campeonato y estadísticas.
- Consulta de tiempos en vivo desde un servidor externo.
- Habilitación deportiva configurable por campeonato en Tiempos en vivo: porcentaje que libera el mínimo de vueltas, porcentaje máximo excluyente y cantidad mínima de vueltas para el tramo intermedio.
- CADPO CLUB con hasta tres servidores gratuitos, enlace directo de ingreso por Content Manager y enlace independiente para consultar tanda y pilotos conectados en tiempo real.
- Panel administrativo para gestionar el contenido.
- Carga de imágenes, logos y reglamentos PDF.
- Sección pública **Pinturas** con selección del campeonato más reciente, descarga permanente del ZIP de plantillas y entrega de archivos DDS, PNG o JPG por piloto inscripto. La recepción se abre al configurar una fecha futura y se cierra automáticamente al vencer, con fecha, hora y cuenta regresiva. La carga bloquea la pantalla mientras procesa, evita nombres duplicados y actualiza las miniaturas PNG/JPG y el detalle de DDS del piloto; en Administración las entregas se descargan agrupadas en un ZIP identificado por número, piloto, marca y modelo.
- Notas de pista ordenables por circuito, con título e imágenes editables, reutilización selectiva entre variantes y visor emergente en el inicio.
- Importador de escritorio para cargas masivas en MySQL.
- Pantalla automática de mantenimiento cuando la API o la base de datos no están disponibles.
- Chat público con Ayrton, asistente IA conectado a Cloudflare Workers AI y alimentado mediante consultas de solo lectura sobre campeonatos actuales, anteriores y futuros, días y horarios de sus calendarios, tablas completas, resultados publicados, pilotos, CADPO CLUB, repeticiones, pinturas y proyectos, con acceso bajo demanda a las APIs en vivo.
- Ayrton prioriza siempre los campeonatos en curso y las inscripciones abiertas, y distingue resultados en proceso, provisorios o definitivos junto con sus plazos y apelaciones visibles.
- Las consultas de Ayrton están limitadas a 300 caracteres; los mensajes redactados principalmente en inglés, las solicitudes peligrosas, los temas ajenos a CADPO/automovilismo y los intentos de alterar sus instrucciones se bloquean localmente, incluso dentro del historial, antes de consumir recursos de Cloudflare AI.
- Ayrton funciona exclusivamente en modo informativo y de solo lectura: no ejecuta ni confirma altas, modificaciones, eliminaciones, publicaciones o cambios solicitados por usuarios, y no incorpora como oficiales datos aportados en el chat.
- Al alcanzar el límite diario, o cuando Cloudflare informa que agotó su asignación real de 10.000 neuronas, el consumo se sincroniza al 100% y el acceso público de Ayrton permanece visible, sin interacciones, con el estado **En entrenamiento · No disponible** hasta el reinicio.
- Conocimiento técnico curado para que Ayrton responda consultas de puesta a punto en Assetto Corsa sobre neumáticos, alineación, suspensión, amortiguadores, frenos, diferencial, aerodinámica y relaciones de caja.
- Referencia 2026 de categorías argentinas para Ayrton, con siglas, modelos, mecánica, tracción y comportamiento, diferenciando el parque real de los mods históricos o balanceados por CADPO.
- Catálogo contextual de autódromos y circuitos zonales argentinos para Ayrton, incluidos trazados chicos de asfalto y tierra, variantes, estado histórico/actual, usos pasados y futuros confirmados en calendarios de CADPO, más el calendario oficial vigente de Fórmula 1 2026.
- Historial de consultas y respuestas de Ayrton en Cloudflare D1, con aviso por correo mediante el SMTP del sitio.
- Panel mensual de consumo de Ayrton en Administración, con el porcentaje utilizado cada día, solicitudes, tokens de entrada/salida y neuronas calculadas para el modelo activo; al alcanzar el tope local, el chat se oculta por completo y vuelve a habilitarse automáticamente con el reinicio de Cloudflare a las 00:00 UTC.
- Contexto general administrable en Cloudflare D1: desde **Administración > Ayrton** se mantiene un único texto oficial siempre disponible. El historial se conserva solo como registro y nunca se incorpora automáticamente a las respuestas.
- SEO por sección pública con títulos, descripciones, palabras relacionadas, URL canónica, Open Graph y datos estructurados; `sitemap.xml` se mantiene con las rutas canónicas y `robots.txt` evita el rastreo de API y videos de apelaciones.

### Gestión deportiva y resultados

El panel de resultados permite importar tandas de Assetto Corsa, trabajar sobre una planilla editable y publicar cada fecha cuando la revisión deportiva está terminada. Entre las funciones principales se incluyen:

- clasificación Sprint, Sprint, clasificación Final y Final administradas por separado;
- sanciones múltiples por piloto, recargos de tiempo o posiciones, DQ, apercibimientos y lastre;
- recálculo de posiciones al aplicar sanciones deportivas, conservando por fila los puntos y lastres que ya fueron ajustados manualmente;
- escalas configurables por campeonato para aplicar automáticamente los puntos y lastres de Sprint y Final durante la carga inicial;
- lastre debut, lastre por fecha, lastre por sanciones y total proyectado antes de guardar;
- resultados visibles u ocultos por fecha, confirmación definitiva y plazo configurable para apelaciones;
  - apelaciones por tanda y piloto, con motivo, video opcional, gestión de estado pendiente/aprobada/denegada y publicación diferenciada dentro del resultado de la fecha;
- formulario anónimo de denuncias con tandas habilitadas por campeonato desde Administración: clasificación Sprint, Sprint, clasificación Final y Final;
- exclusión de pilotos por campeonato sin alterar sus resultados históricos, con puntaje general anulado y omisión en las tablas de lastre;
- sanciones de clasificación pendientes por piloto y campeonato, sin asignaciones duplicadas y con una nota opcional por piloto visible en Tiempos en vivo;
- tabla general del campeonato, estadísticas e imágenes exportables de posiciones.

Las correcciones manuales permanecen editables antes del guardado definitivo. Los cambios pendientes se identifican visualmente en la planilla.

### Tecnologías

| Componente | Tecnologías |
| --- | --- |
| Frontend | React 19, React Router, Vite 8, Tailwind CSS, Axios |
| Backend | Node.js, Express 5, MySQL2, Multer, express-validator |
| Importador | Python 3, Tkinter, tksheet, MySQL Connector/Python |
| Base de datos | MySQL y Cloudflare D1 para el historial de Ayrton |

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
| `PUBLIC_DIR` | Directorio persistente donde se leen y guardan los archivos públicos subidos; en hosting debe quedar fuera de `hbuilds` y `public_html` | `frontend/public` en local |
| `PRIVATE_UPLOADS_DIR` | Directorio privado y persistente para las pinturas entregadas por pilotos | `backend/storage` |
| `LIVE_TIMING_HOST` | Servidor externo de tiempos en vivo | `rh.servegame.com` |
| `VITE_API_TARGET` | Destino del proxy de Vite durante el desarrollo | `http://localhost:3000` |
| `CLOUDFLARE_ACCOUNT_ID` | Identificador de la cuenta que ejecuta Workers AI | Requerido para Ayrton |
| `CLOUDFLARE_AI_API_TOKEN` | Token de API con permiso para ejecutar Workers AI | Requerido para Ayrton |
| `CLOUDFLARE_AI_GATEWAY_ID` | Gateway opcional para observabilidad y controles de Cloudflare | Vacío |
| `CLOUDFLARE_AI_MODEL` | Modelo utilizado por Ayrton | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `AYRTON_REQUESTS_PER_MINUTE` | Límite de consultas por IP y por minuto | `12` |
| `CLOUDFLARE_D1_DATABASE_ID` | Identificador de la base D1 que conserva las conversaciones | Vacío; el chat sigue funcionando sin historial |
| `CLOUDFLARE_D1_API_TOKEN` | Token con permiso `D1 Edit`; puede omitirse si el token de IA también tiene ese permiso | `CLOUDFLARE_AI_API_TOKEN` |
| `AYRTON_IP_SECRET` | Secreto utilizado para guardar un hash irreversible de la IP | `POLL_IP_SECRET` |
| `AYRTON_EMAIL_NOTIFICATIONS` | Envía un correo por cada respuesta de Ayrton | `true` |
| `AYRTON_ERROR_EMAIL_NOTIFICATIONS` | Envía un correo con la consulta y el error cuando Ayrton no puede responder | `true` |
| `AYRTON_DAILY_NEURON_LIMIT` | Tope diario local de Ayrton, reiniciado a las 00:00 UTC | `10000` |
| `AYRTON_NOTIFY_EMAIL` | Destinatario de las notificaciones de Ayrton | `LIVE_MONITOR_EMAIL` |

No subas archivos `.env` ni credenciales al repositorio.

Para preparar D1, creá una base desde **Cloudflare > Storage & Databases > D1**, abrí su consola y ejecutá `backend/scripts/createAyrtonD1.sql`. Después copiá el identificador de la base en `CLOUDFLARE_D1_DATABASE_ID`. El registro en D1 y el correo son tolerantes a fallos: una interrupción de cualquiera de esos servicios no impide que Ayrton responda.

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
- `/ayrton`

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

Como criterio del proyecto, documentá solamente cambios funcionales, estructurales o de operación relevantes. Las correcciones visuales menores y ajustes internos no necesitan una entrada individual.

---

## English

Web platform for managing and publishing CADPO sim racing championships. The repository includes the public website, a REST API, an administration panel, and a desktop application for bulk driver and result imports.

### Features

- Championships, categories, calendars, and upcoming events.
- Registrations, drivers, cars, manufacturers, and circuits.
- Results, championship standings, and statistics.
- Live timing retrieved from an external server.
- CADPO CLUB with up to three free servers, current session status, and live connected-driver counts.
- Administration panel for content management.
- Image, logo, and PDF regulation uploads.
- Public **Paints** section with the newest championship selected by default, permanent template ZIP downloads, and private DDS, PNG or JPG submissions by enrolled drivers. Submissions are enabled per championship, close automatically with a visible countdown, and are managed from Administration.
- Sortable per-circuit track notes with editable titles and images, selective reuse across variants, and a modal viewer on the home page.
- Desktop importer for bulk MySQL operations.
- Automatic maintenance screen when the API or database is unavailable.
- Public Ayrton AI chat connected to Cloudflare Workers AI, with read-only access to current, previous and future championships, calendar weekdays and times, full standings, published results, drivers, CADPO CLUB, replays, paints and projects, plus on-demand access to live APIs.
- Ayrton always prioritizes championships in progress and open registrations, distinguishing results in progress, provisional or final together with visible appeal windows and appeals.
- Curated technical knowledge enabling Ayrton to answer Assetto Corsa setup questions about tyres, alignment, suspension, dampers, brakes, differential, aerodynamics, and gearing.
- A 2026 Argentine racing-category reference for Ayrton covering acronyms, models, mechanics, drivetrain, and handling while keeping real-world grids separate from CADPO's historical or balanced mods.
- Contextual Argentine circuit knowledge for Ayrton, including smaller asphalt and dirt venues, layouts, historical/current status, confirmed past and future CADPO usage, and the current official 2026 Formula 1 calendar.
- Ayrton question and answer history in Cloudflare D1, with email notifications through the website SMTP service.
- Monthly Ayrton usage panel in Administration, showing daily percentage, requests, Cloudflare-reported input/output tokens, and calculated neurons for the active model; upon reaching the local cap, the chat is fully hidden and automatically returns with Cloudflare's 00:00 UTC reset.
- General context stored in Cloudflare D1: **Administration > Ayrton** provides one always-available official text. Conversation history remains audit-only and is never incorporated into answers automatically.
- Per-section SEO for public pages, including titles, descriptions, related terms, canonical URLs, Open Graph metadata, and structured data; `sitemap.xml` tracks canonical routes while `robots.txt` excludes the API and appeal videos from crawling.

### Sporting management and results

The results administration panel can import Assetto Corsa sessions, edit them in a spreadsheet-like workspace, and publish each event after the sporting review is complete. Its main capabilities include:

- separate Sprint qualifying, Sprint, Final qualifying, and Final sessions;
- multiple sanctions per driver, time or position penalties, disqualifications, warnings, and ballast;
- automatic position and point recalculation when sporting penalties are applied;
- championship-specific scoring and Sprint/Final ballast scales;
- debut ballast, event ballast, sanction ballast, and a projected total before saving;
- per-event result visibility, definitive confirmation, and configurable appeal deadlines;
- session- and driver-specific appeals with a reason, optional video, and public display alongside event results;
- anonymous complaints with championship-specific session options managed from Administration;
- championship standings, statistics, and exportable standings images.

Manual corrections remain editable until the final save. Pending changes are visually identified in the worksheet.

### Technology stack

| Component | Technologies |
| --- | --- |
| Frontend | React 19, React Router, Vite 8, Tailwind CSS, Axios |
| Backend | Node.js, Express 5, MySQL2, Multer, express-validator |
| Importer | Python 3, Tkinter, tksheet, MySQL Connector/Python |
| Database | MySQL and Cloudflare D1 for Ayrton conversation history |

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
| `PUBLIC_DIR` | Persistent directory used for uploaded public files; on hosting it must remain outside `hbuilds` and `public_html` | `frontend/public` locally |
| `PRIVATE_UPLOADS_DIR` | Private persistent directory for driver paint submissions | `backend/storage` |
| `LIVE_TIMING_HOST` | External live timing server | `rh.servegame.com` |
| `VITE_API_TARGET` | Vite proxy target during development | `http://localhost:3000` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier used for Workers AI | Required for Ayrton |
| `CLOUDFLARE_AI_API_TOKEN` | API token allowed to run Workers AI | Required for Ayrton |
| `CLOUDFLARE_AI_GATEWAY_ID` | Optional AI Gateway for Cloudflare observability and controls | Empty |
| `CLOUDFLARE_AI_MODEL` | Model used by Ayrton | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| `AYRTON_REQUESTS_PER_MINUTE` | Requests allowed per IP per minute | `12` |
| `CLOUDFLARE_D1_DATABASE_ID` | D1 database identifier used for conversation history | Empty; chat remains available without history |
| `CLOUDFLARE_D1_API_TOKEN` | Token with `D1 Edit`; optional when the AI token already has this permission | `CLOUDFLARE_AI_API_TOKEN` |
| `AYRTON_IP_SECRET` | Secret used to create an irreversible IP hash | `POLL_IP_SECRET` |
| `AYRTON_EMAIL_NOTIFICATIONS` | Sends an email for each Ayrton response | `true` |
| `AYRTON_ERROR_EMAIL_NOTIFICATIONS` | Emails the question and error when Ayrton cannot respond | `true` |
| `AYRTON_DAILY_NEURON_LIMIT` | Ayrton local daily cap, reset at 00:00 UTC | `10000` |
| `AYRTON_NOTIFY_EMAIL` | Ayrton notification recipient | `LIVE_MONITOR_EMAIL` |

Never commit `.env` files or credentials.

To prepare D1, create a database under **Cloudflare > Storage & Databases > D1**, open its console, and execute `backend/scripts/createAyrtonD1.sql`. Then set `CLOUDFLARE_D1_DATABASE_ID` to the database identifier. D1 logging and email notifications fail independently, so neither service can prevent Ayrton from answering.

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
- `/ayrton`

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

As a project convention, document relevant functional, structural, and operational changes. Minor visual corrections and internal adjustments do not require individual changelog-style entries.

## License

No repository-wide license has been declared. All rights remain with the project owner unless a license file is added.
