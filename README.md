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

- Python 3.11+e laptop by default.

If you wanted to use PostgreSQL instead, the code already supports it through `DATABASE_URL` in `backend/app_factory.py`. To use it, you would need to point `DATABASE_URL` at a PostgreSQL database and install the matching PostgreSQL driver in the backend environment before starting the app.

For this class version, we are still using the local SQLite database on each individual laptop.

## Demo / Test Accounts

To quickly set up demo accounts and a sample subscription, run this from the `backend/` folder:

```powershell
python test_accounts.py
```

This script creates three test users and a shared Netflix Family subscription with all three users as members. Output will show:

```
Demo data ready.
Users:
- alice / alice@example.com / password123
- bob / bob@example.com / password123
- carol / carol@example.com / password123
Subscription: Netflix Family
```

**How to use the demo accounts:**

1. Start the backend: `python run_simple.py`
2. Start the frontend: `npm start` (from the `frontend/` folder)
3. Log in using any of the test accounts above with email and password
4. The Netflix Family subscription is already created with all three users
5. Try adding/removing members, managing costs, and splitting payments

The test accounts will persist in your local SQLite database (`backend/instance/money_lovers.db`). You can re-run `test_accounts.py` anytime without error—it checks if accounts already exist before creating them.

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
