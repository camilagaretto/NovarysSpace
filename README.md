# Novarys Space MVP

Dashboard web para monitorear aproximaciones orbitales estimadas entre satelites argentinos y objetos catalogados, usando datos publicos de CelesTrak y propagacion SGP4.

El proyecto no predice colisiones exactas. Detecta eventos de proximidad, calcula TCA, distancia minima estimada y un nivel de severidad para revision humana.

## Estructura

```txt
backend/   FastAPI + SQLite + SGP4
frontend/  Vite + React + TypeScript
```

## Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

API local:

```txt
http://localhost:8000
```

Endpoints principales:

```txt
GET  /api/health
GET  /api/satellites
POST /api/ingest
POST /api/scan?days=5
GET  /api/events
GET  /api/report
```

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

App local:

```txt
http://localhost:5173
```

Para apuntar a otro backend:

```powershell
$env:VITE_API_URL="https://tu-backend.onrender.com"
npm run dev
```

## Tests

```powershell
cd backend
pytest
```

## Nota tecnica

El sistema detecta eventos estimados de proximidad orbital con datos publicos y propagacion SGP4. No reemplaza un analisis operacional de seguridad espacial.
