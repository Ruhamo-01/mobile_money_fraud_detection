# MoMo Shield — Mobile Money Fraud Detection System

Real-time fraud detection for Rwanda mobile money (MTN & Airtel) combining XGBoost ML, biometric face verification, and Explainable AI.

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 14+**
- **Visual Studio Build Tools** (Windows) — required to build `dlib` / `face-recognition`
  → https://visualstudio.microsoft.com/visual-cpp-build-tools/

---

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd mobile_money_fraud_detection
```

### 2. Create and activate a Python virtual environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

> **Note:** If `dlib` fails to build on Windows, install Visual Studio Build Tools (C++ workload) first, then retry.

### 4. Create the PostgreSQL database

```sql
CREATE DATABASE momo_fraud;
```

### 5. Configure environment variables

```bash
copy .env.example .env   # Windows
cp .env.example .env     # Mac/Linux
```

Edit `.env` and set your PostgreSQL credentials:

```env
DB_NAME=momo_fraud
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_HOST=localhost
DB_PORT=5432
FRONTEND_URL=http://localhost:5173
```

### 6. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### 7. Run the system

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
python app.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Creating an Admin Account

The system creates all tables automatically on first run. Register a customer account through the UI, then promote it to admin directly in PostgreSQL:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Tailwind CSS + Vite |
| Backend | Python 3.11 + Flask |
| Database | PostgreSQL |
| ML Model | XGBoost (trained in `Momo_Clean.ipynb`) |
| Face Verification | face_recognition (dlib) |
| Explainability | SHAP TreeExplainer |
| Email | EmailJS (no SMTP required) |

---

## Project Structure

```
mobile_money_fraud_detection/
├── app.py                  # Flask backend — 40+ REST endpoints
├── auth_system.py          # Auth, sessions, PIN, password reset
├── fraud_detection.py      # ML engine, face verification, XAI, alerts
├── money_transfer.py       # Transfer pipeline with fraud scoring
├── run_system.py           # Optional startup helper script
├── fraud_best_model.pkl    # Trained XGBoost model
├── fraud_scaler.pkl        # Feature scaler
├── fraud_config.json       # Model config (threshold, features, metrics)
├── momo_fraud.sql          # Database schema export
├── Momo_Clean.ipynb        # Model training notebook
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables (not committed)
├── .env.example            # Environment variable template
└── frontend/               # React SPA
    ├── src/
    │   ├── components/     # Admin, Manager, Customer dashboards
    │   └── utils/          # emailService.js, helpers.js
    └── package.json
```

---

## Model Performance

| Metric | Value |
|---|---|
| ROC-AUC | 0.9728 |
| Fraud F1 | 0.7223 |
| Decision Threshold | 0.38 |

Trained on 200,000 synthetic Rwanda-scale transactions.

---

## Author

**RUHAMO Rose** | Reg: 25RP21044  
RP Huye College · Department of ICT · 2025–2026  
Supervisor: Mrs. BIZIMANA Judith
