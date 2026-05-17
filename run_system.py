#!/usr/bin/env python3
"""
run_system.py — MoMo Shield Startup Script
============================================
Checks dependencies, verifies ML model files,
then launches the Flask server.

Usage:
  python run_system.py            # normal start
  python run_system.py --train    # retrain model first, then start
  python run_system.py --check    # check only, do not start server
"""

import os
import sys
import json
import time
import argparse
import webbrowser
from threading import Thread


# ─────────────────────────────────────────────────────────────────────────────
# DISPLAY
# ─────────────────────────────────────────────────────────────────────────────

def banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║          MOMO SHIELD — Fraud Detection System  v2.0          ║
║  ML-Powered · Face Verification · Travel Control · Alerts    ║
╚══════════════════════════════════════════════════════════════╝
""")

def ok(msg):   print(f"  ✅  {msg}")
def warn(msg): print(f"  ⚠️   {msg}")
def err(msg):  print(f"  ❌  {msg}")
def info(msg): print(f"  ℹ️   {msg}")
def sep():     print("  " + "─" * 58)


# ─────────────────────────────────────────────────────────────────────────────
# 1. DEPENDENCY CHECK
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED = {
    # package_name : import_name
    "flask"          : "flask",
    "flask-cors"     : "flask_cors",
    "pandas"         : "pandas",
    "numpy"          : "numpy",
    "scikit-learn"   : "sklearn",
    "joblib"         : "joblib",
    "requests"       : "requests",
    "xgboost"        : "xgboost",
    "lightgbm"       : "lightgbm",
    "imbalanced-learn": "imblearn",
}

OPTIONAL = {
    "face-recognition": "face_recognition",
    "opencv-python"   : "cv2",
    "Pillow"          : "PIL",
}

def check_dependencies() -> bool:
    print("\n  Checking required packages…")
    missing = []
    for pkg, imp in REQUIRED.items():
        try:
            __import__(imp)
            ok(pkg)
        except ImportError:
            err(f"{pkg}  ← MISSING")
            missing.append(pkg)

    print("\n  Checking optional packages (face recognition)…")
    for pkg, imp in OPTIONAL.items():
        try:
            __import__(imp)
            ok(f"{pkg}  (optional)")
        except ImportError:
            warn(f"{pkg}  not installed — face verification will use fallback mode")

    if missing:
        print(f"\n  Install missing packages:")
        print(f"    pip install {' '.join(missing)}")
        print(f"\n  Or install everything at once:")
        print(f"    pip install -r requirements.txt")
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 2. FILE CHECKS
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED_FILES = [
    "app.py",
    "auth_system.py",
    "fraud_detection.py",
    "money_transfer.py",
]

MODEL_FILES = [
    "fraud_best_model.pkl",
    "fraud_scaler.pkl",
    "fraud_config.json",
]

TEMPLATE_FILES = []  # React frontend served by Vite — no HTML templates needed

def check_files() -> bool:
    print("\n  Checking core Python files…")
    all_ok = True
    for f in REQUIRED_FILES:
        if os.path.exists(f):
            ok(f)
        else:
            err(f"{f}  ← NOT FOUND")
            all_ok = False

    print("\n  Checking ML model files…")
    model_ready = True
    for f in MODEL_FILES:
        if os.path.exists(f):
            size = os.path.getsize(f)
            ok(f"{f}  ({size:,} bytes)")
        else:
            warn(f"{f}  not found — model not trained yet")
            model_ready = False

    if model_ready:
        try:
            with open("fraud_config.json") as fh:
                cfg = json.load(fh)
            ok(f"Model: {cfg.get('best_model','?')}  "
               f"| Fraud F1: {cfg.get('fraud_f1','?')}  "
               f"| AUC: {cfg.get('roc_auc','?')}  "
               f"| Threshold: {cfg.get('threshold','?')}")
        except Exception as e:
            warn(f"Could not read fraud_config.json: {e}")

    info("Frontend: React SPA served by Vite on http://localhost:5173")
    info("Backend:  Flask API served on http://localhost:5000")

    return all_ok


# ─────────────────────────────────────────────────────────────────────────────
# 3. DATABASE CHECK
# ─────────────────────────────────────────────────────────────────────────────

def check_database() -> bool:
    print("\n  Checking PostgreSQL connection…")
    try:
        import psycopg2
        conn = psycopg2.connect(
            dbname='momo_fraud', user='postgres',
            password='Admin@123', host='localhost', port='5432'
        )
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM users")
        count = c.fetchone()[0]
        conn.close()
        ok(f"PostgreSQL connected — {count} users in DB")
    except Exception as e:
        err(f"PostgreSQL connection failed: {e}")
        return False
    return True


# ─────────────────────────────────────────────────────────────────────────────
# 4. DATASET CHECK
# ─────────────────────────────────────────────────────────────────────────────

def check_dataset():
    print("\n  Checking training dataset…")
    if os.path.exists("Fraud.csv"):
        size = os.path.getsize("Fraud.csv")
        ok(f"Fraud.csv  ({size/1e6:.1f} MB)")
        return True
    else:
        warn("Fraud.csv not found")
        info("Download from Kaggle: 'paysim1' synthetic financial dataset")
        info("Place Fraud.csv in the same folder as this script")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 5. TRAIN MODEL  (called with --train flag)
# ─────────────────────────────────────────────────────────────────────────────

def train_model():
    """
    Execute the Jupyter notebook non-interactively using nbconvert,
    which runs all cells and saves fraud_best_model.pkl etc.
    Falls back to a plain Python training script if nbconvert is missing.
    """
    print("\n  Training ML model from Momo_Clean.ipynb…")
    sep()

    notebook = "Momo_Clean.ipynb"
    if not os.path.exists(notebook):
        err(f"{notebook} not found — cannot train.")
        return False

    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "-m", "jupyter", "nbconvert",
             "--to", "notebook", "--execute",
             "--ExecutePreprocessor.timeout=600",
             "--inplace", notebook],
            capture_output=False
        )
        if result.returncode == 0:
            ok("Notebook executed successfully.")
            return True
        else:
            warn("nbconvert execution had errors — check notebook output.")
            return False
    except FileNotFoundError:
        warn("jupyter not found. Install with:  pip install jupyter nbconvert")
        warn("Alternatively, open Momo_Clean.ipynb in Jupyter and run all cells.")
        return False
    except Exception as e:
        err(f"Training failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 6. SERVER LAUNCH
# ─────────────────────────────────────────────────────────────────────────────

def open_browser():
    """Open browser after 3-second delay so Flask has time to bind."""
    time.sleep(3)
    try:
        webbrowser.open("http://localhost:5173")
        ok("Browser opened automatically")
    except Exception:
        info("Open http://localhost:5000 in your browser manually")


def start_server():
    print("\n  Starting Flask API server…")
    sep()
    info("URL        : http://localhost:5000")
    info("Health     : http://localhost:5000/api/health")
    info("Frontend   : http://localhost:5173  (run: npm run dev)")
    info("Login      : http://localhost:5173/login")
    sep()
    info("Press Ctrl+C to stop")
    sep()
    print()

    # Open browser in background thread
    Thread(target=open_browser, daemon=True).start()

    try:
        from app import app
        app.run(debug=False, host="0.0.0.0", port=5000)
    except ImportError as e:
        err(f"Cannot import app.py: {e}")
        sys.exit(1)
    except OSError as e:
        if "Address already in use" in str(e):
            err("Port 5000 is already in use.")
            info("Kill the existing process or change the port in app.py")
        else:
            err(f"Server error: {e}")
        sys.exit(1)
    except Exception as e:
        err(f"Unexpected error: {e}")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="MoMo Shield — Fraud Detection System Launcher")
    parser.add_argument("--train", action="store_true",
                        help="Run Momo_Clean.ipynb to train ML model before starting")
    parser.add_argument("--check", action="store_true",
                        help="Run checks only, do not start server")
    args = parser.parse_args()

    banner()

    # ── 1. Dependencies ──────────────────────────────────────────────────
    sep()
    print("  STEP 1 — Dependency Check")
    sep()
    deps_ok = check_dependencies()
    if not deps_ok:
        err("Fix missing dependencies before continuing.")
        sys.exit(1)

    # ── 2. Files ─────────────────────────────────────────────────────────
    sep()
    print("  STEP 2 — File Check")
    sep()
    check_files()

    # ── 3. Database ───────────────────────────────────────────────────────
    sep()
    print("  STEP 3 — Database Check")
    sep()
    check_database()

    # ── 4. Dataset ────────────────────────────────────────────────────────
    sep()
    print("  STEP 4 — Dataset Check")
    sep()
    dataset_ok = check_dataset()

    # ── 5. Train (optional) ───────────────────────────────────────────────
    if args.train:
        if not dataset_ok:
            err("Cannot train without Fraud.csv")
            sys.exit(1)
        sep()
        print("  STEP 5 — Model Training")
        sep()
        train_ok = train_model()
        if not train_ok:
            warn("Training failed — server will run in rule-based mode only")

    # ── Model status summary ──────────────────────────────────────────────
    model_loaded = all(os.path.exists(f) for f in MODEL_FILES)
    sep()
    if model_loaded:
        ok("ML model ready — full fraud detection enabled")
    else:
        warn("ML model NOT found — running in rule-based fallback mode")
        info("To train the model:")
        info("  1. Make sure Fraud.csv is in this folder")
        info("  2. Run:  python run_system.py --train")
        info("  OR open Momo_Clean.ipynb in Jupyter and run all cells")

    # ── Check only mode ───────────────────────────────────────────────────
    if args.check:
        sep()
        ok("Check complete. Server not started (--check mode).")
        return

    # ── 6. Start server ───────────────────────────────────────────────────
    sep()
    print("  STEP 6 — Starting Server")
    sep()
    start_server()


# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n  Server stopped.")
        print("  Data saved in PostgreSQL (momo_fraud database)")
        print("  Run again with:  python run_system.py")
        print()
    except Exception as e:
        print(f"\n  Fatal error: {e}")
        print("  Check the README for troubleshooting.")
        sys.exit(1)