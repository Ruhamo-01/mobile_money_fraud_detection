# MoMo Shield — AI-Powered Mobile Money Fraud Detection

A full-stack fraud detection system for Rwanda's mobile money ecosystem (MTN & Airtel), combining an XGBoost ML model, biometric face verification, PIN security, and travel SIM control.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.14, Flask, PostgreSQL |
| ML Model | XGBoost (97.28% AUC, 20 features) |
| Face Recognition | `face_recognition` + `dlib` |
| Frontend | React 18, Vite, Tailwind CSS |

---

## Requirements

- Python 3.10+ (tested on 3.14)
- PostgreSQL 14+
- Node.js 18+
- `pg_dump` in PATH (for database backup)

---

## Setup

### 1. Clone and create virtual environment

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Linux/Mac
pip install -r requirements.txt
```

### 2. Database

Create the database and run the schema:

```bash
psql -U postgres -c "CREATE DATABASE momo_fraud;"
psql -U postgres -d momo_fraud -f momo_fraud.sql
```

### 3. ML Model

The trained model files (`fraud_best_model.pkl`, `fraud_scaler.pkl`, `fraud_config.json`) must be present in the project root. To retrain:

```bash
python run_system.py --train
```

### 4. Start the backend

```bash
python app.py
# API runs on http://localhost:5000
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
# UI runs on http://localhost:5173
```

---

## Roles & Default Accounts

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@admin.com` | Full system control |
| Manager | `provider@provider.com` | Fraud monitoring, travel control |
| Customer | Register via UI | Send money, face verification |

---

## Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register` | Register customer with face |
| POST | `/api/login` | Login (all roles) |
| POST | `/api/transfer` | Initiate ML-scored transfer |
| POST | `/api/verify-pin` | Verify transaction PIN |
| POST | `/api/reset-pin` | Reset PIN via face + National ID |
| GET  | `/api/health` | System health + ML model status |
| GET  | `/api/dashboard/stats` | Live system statistics |
| POST | `/api/admin/settings` | Save system settings to DB |
| POST | `/api/admin/backup` | Download PostgreSQL backup |

---

## Project Structure

```
├── app.py                  Flask API server (all routes)
├── auth_system.py          Authentication, sessions, password reset
├── fraud_detection.py      ML scoring, face verification, travel monitoring
├── money_transfer.py       Transfer flow with fraud gating
├── fraud_best_model.pkl    Trained XGBoost model
├── fraud_scaler.pkl        Feature scaler
├── fraud_config.json       Model config (threshold, features)
├── momo_fraud.sql          PostgreSQL schema + seed data
└── frontend/               React + Vite + Tailwind frontend
    └── src/
        ├── components/
        │   ├── HomePage.jsx
        │   ├── Login.jsx
        │   ├── UserDashboard.jsx
        │   ├── ProviderDashboard.jsx
        │   ├── AdminDashboard.jsx
        │   └── ResetPassword.jsx
        └── utils/helpers.js
```
