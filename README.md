# GemeloDigital — Pricing Elasticity Digital Twin

Multi-tenant SaaS para simular decisiones de pricing usando un gemelo digital de elasticidad precio-demanda.

---

## Requisitos previos

| Herramienta | Versión mínima | Instalación |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org/) |
| **Python** | 3.10+ | [python.org](https://www.python.org/) |
| **Docker Desktop** | 24+ | [docker.com](https://www.docker.com/products/docker-desktop/) |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |

---

## Paso 1 — Clonar / Descargar

**Opción A: Clonar con Git (recomendado)**
```bash
git clone https://github.com/mers2727/GemeloDigital.git
cd GemeloDigital
```

**Opción B: Descargar ZIP desde GitHub**
1. Ir a: `https://github.com/mers2727/GemeloDigital`
2. Click en el botón verde **"<> Code"**
3. Click en **"Download ZIP"**
4. Descomprimir el ZIP
5. Abrir la carpeta en VS Code: `File → Open Folder → seleccionar GemeloDigital`

---

## Paso 2 — Levantar la base de datos (PostgreSQL)

```bash
docker compose up -d
```

Esto levanta PostgreSQL en el puerto **54322** y ejecuta automáticamente la migración (`001_schema.sql`) que crea todas las tablas y políticas RLS.

Para verificar que está corriendo:
```bash
docker compose ps
```

---

## Paso 3 — Configurar y arrancar el Backend

### 3.1 Crear entorno virtual (recomendado)
```bash
cd backend
python -m venv .venv

# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Windows (CMD):
.venv\Scripts\activate.bat

# macOS / Linux:
source .venv/bin/activate
```

### 3.2 Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3.3 Configurar variables de entorno
```bash
cp .env.example .env
```

Editar el archivo `.env` con estos valores para desarrollo local con Docker:

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=mi-secreto-super-seguro-de-al-menos-32-caracteres
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

> **Nota sobre Supabase:** Si no usas Supabase Cloud, el backend funciona directamente contra el PostgreSQL del Docker. Para conectar con Supabase Cloud, sustituye `SUPABASE_URL` y las keys por las de tu proyecto en [supabase.com](https://supabase.com).

### 3.4 Arrancar el servidor
```bash
uvicorn app.main:app --reload --port 8000
```

El API estará disponible en: **http://localhost:8000**

Documentación interactiva (Swagger): **http://localhost:8000/docs**

---

## Paso 4 — Arrancar el Frontend

Abrir **otra terminal** (dejar el backend corriendo):

```bash
cd frontend
npm install
npm run dev
```

La app estará disponible en: **http://localhost:5173**

---

## Paso 5 — Usar la aplicación

### Flujo de onboarding:

1. **Registrarse** — Crear cuenta con email y contraseña
2. **Crear empresa** — Nombre, sector y país (te asigna rol `owner`)
3. **Subir datos** — Archivo Excel (.xlsx) o CSV con columnas de segmento, precio y demanda
4. **Mapear columnas** — Indicar qué columna es segmento, precio y demanda
5. **Construir gemelo** — Seleccionar dataset, perfil y método (OLS o Bayesiano)
6. **Dashboard** — Ver resumen de análisis, tabla de elasticidades y simular decisiones

### Simular decisiones (sin volver a subir datos):
- En el Dashboard, sección "Decision Simulator"
- Nombrar el escenario (ej: "Subir 5% calcetines premium")
- Ajustar el % de cambio de precio por segmento
- Click "Run Simulation"
- Ver resultado con impacto en demanda y revenue por segmento

---

## Estructura del proyecto

```
GemeloDigital/
├── backend/
│   ├── app/
│   │   ├── auth.py              # JWT auth + password hashing
│   │   ├── config.py            # Settings desde .env
│   │   ├── database.py          # Cliente Supabase
│   │   ├── main.py              # FastAPI app + CORS
│   │   ├── migrations/
│   │   │   └── 001_schema.sql   # Tablas + RLS policies
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   ├── routers/
│   │   │   ├── auth.py          # /auth/signup, /auth/login, /me, /company
│   │   │   ├── datasets.py      # /datasets/upload, /profiles
│   │   │   ├── twin.py          # /twin/build, /twin/latest
│   │   │   └── scenarios.py     # /scenarios (CRUD)
│   │   └── services/
│   │       └── math_engine.py   # Regime detection, OLS, Bayes, bootstrap
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Routing + guards
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Auth state global
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── CompanySetupPage.tsx
│   │   │   ├── UploadDataPage.tsx
│   │   │   ├── BuildTwinPage.tsx
│   │   │   └── DashboardPage.tsx
│   │   ├── services/
│   │   │   └── api.ts           # HTTP client
│   │   └── types/
│   │       └── index.ts         # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts           # Proxy /api → backend:8000
└── docker-compose.yml           # PostgreSQL local
```

---

## API Endpoints

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| POST | `/auth/signup` | Registrar usuario | Público |
| POST | `/auth/login` | Login → JWT | Público |
| GET | `/me` | Usuario actual + empresa + rol | Auth |
| POST | `/company` | Crear empresa | Auth |
| GET | `/company` | Ver empresa actual | Auth |
| POST | `/datasets/upload` | Subir Excel/CSV | owner, admin |
| GET | `/datasets` | Listar datasets | Auth |
| POST | `/profiles` | Crear perfil de columnas | owner, admin |
| GET | `/profiles` | Listar perfiles | Auth |
| POST | `/twin/build` | Construir gemelo digital | owner, admin, analyst |
| GET | `/twin/latest` | Último análisis completado | Auth |
| GET | `/twin/analyses` | Listar análisis | Auth |
| GET | `/twin/analysis/{id}` | Detalle de análisis | Auth |
| POST | `/scenarios` | Simular decisión | owner, admin, analyst |
| GET | `/scenarios` | Listar escenarios | Auth |
| GET | `/scenarios/{id}` | Detalle de escenario | Auth |

---

## Ejemplo de archivo de datos (Excel/CSV)

El archivo debe tener al menos 3 columnas: segmento, precio y demanda.

| segmento | precio | demanda |
|---|---|---|
| calcetines_premium | 12.50 | 3200 |
| calcetines_premium | 13.00 | 2980 |
| calcetines_basico | 5.00 | 8500 |
| calcetines_basico | 5.25 | 8100 |
| camisetas_sport | 25.00 | 1500 |
| camisetas_sport | 26.50 | 1380 |

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `docker compose up` falla | Asegúrate de que Docker Desktop está corriendo |
| Puerto 54322 ocupado | Cambiar puerto en `docker-compose.yml` |
| Puerto 8000 ocupado | `uvicorn app.main:app --reload --port 8001` |
| `ModuleNotFoundError` en Python | Verifica que el venv está activado: `which python` |
| Frontend no conecta al backend | Verificar que backend corre en :8000 (el proxy de Vite redirige `/api`) |
