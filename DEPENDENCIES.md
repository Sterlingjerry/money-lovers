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

If `DATABASE_URL` is not set, the backend now falls back to a local SQLite file so the app can start on another laptop without a PostgreSQL server.