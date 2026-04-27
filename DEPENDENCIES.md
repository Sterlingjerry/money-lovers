# Dependencies

This project uses separate dependency files for each stack:

- Backend: [backend/requirements.txt](backend/requirements.txt)
- Frontend: [frontend/package-lock.json](frontend/package-lock.json)

## Install

Backend:

```powershell
cd backend
pip install -r requirements.txt
```

Frontend:

```powershell
cd frontend
npm install
```

## Run

Backend:

```powershell
cd backend
python run_simple.py
```

Frontend:

```powershell
cd frontend
npm start
```

For shared team data, set `DATABASE_URL` to the same PostgreSQL database on every laptop. The backend uses psycopg 3, so install [backend/requirements.txt](backend/requirements.txt) before running. If `DATABASE_URL` is not set, the backend uses the default PostgreSQL URL in [backend/app_factory.py](backend/app_factory.py).