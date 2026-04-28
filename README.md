# Money Lovers

Money Lovers is a full-stack subscription sharing app for tracking shared plans, splitting costs, and managing who owes what.

## What it does

- Register and log in with email and username
- Create shared subscriptions like Netflix or Spotify
- Add team members to a subscription
- Split monthly cost across members
- Track payment status and totals
- Search users by username or email when adding members

## Project structure

- `frontend/` - React app
- `backend/` - Flask API, database models, and routes

## Requirements

- Node.js and npm
- Python 3.11+
- A single laptop for running the app locally
- No shared database server required yet

## Optional PostgreSQL Setup

This repo is set up to run locally with SQLite on one laptop by default.

If you wanted to use PostgreSQL instead, the code already supports it through `DATABASE_URL` in `backend/app_factory.py`. To use it, you would need to point `DATABASE_URL` at a PostgreSQL database and install the matching PostgreSQL driver in the backend environment before starting the app.

For this class version, we are still using the local SQLite database on each individual laptop.

## Demo / Test Accounts

You can create demo accounts and a sample subscription by running this from the `backend/` folder:

```powershell
python seed_demo_data.py
```

Demo logins:

- `alice@example.com` / `password123`
- `bob@example.com` / `password123`
- `carol@example.com` / `password123`

The script also creates a sample shared subscription named `Netflix Family` so you can demo adding members and splitting costs.

## Setup

### 1. Backend

Install Python dependencies:

```powershell
cd backend
pip install -r requirements.txt
```

The backend uses a local SQLite database on your laptop by default:

```powershell
$env:DATABASE_URL='sqlite:///money_lovers.db'
```

If `DATABASE_URL` is not set yet, the app still runs with the local SQLite file on one laptop.

Start the backend:

```powershell
python run_simple.py
```

### 2. Frontend

Install frontend dependencies:

```powershell
cd frontend
npm install
```

Start the frontend:

```powershell
npm start
```

## How to use the app

1. Open the frontend in your browser.
2. Create an account with email, username, and password.
3. Log in.
4. Create a subscription with a name, monthly cost, and billing date.
5. Open the subscription and search for another user by username or email.
6. Add that user as a member.
7. View the member count and payment split for the subscription.

## Team demo note

This version is meant to run on one laptop with a local SQLite database. We are not using a shared PostgreSQL URL yet, so each machine will have its own local data.

## Running tests

Backend tests:

```powershell
cd backend
pytest test_models.py test_routes.py -q
```

Frontend tests:

```powershell
cd frontend
npm test -- --watchAll=false --passWithNoTests
```

## Troubleshooting

- If you can only see accounts created on your own laptop, that is expected for this version because the database is local to that laptop.
- If the backend fails to start, make sure you are running from the `backend/` folder and that the local SQLite file is writable.
- If the frontend cannot connect, confirm the backend is running on port 5000.
