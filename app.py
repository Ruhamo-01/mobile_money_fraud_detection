"""
app.py — Flask REST API Server
================================
Routes:
  Pages
    GET  /                        → index.html
    GET  /login                   → login.html
    GET  /dashboard               → dashboard.html

  Auth
    POST /api/register            → create account (+ face at signup)
    POST /api/login               → login, get session token
    POST /api/validate-session    → check token, return user info
    POST /api/logout              → destroy session
    POST /api/reset-password      → request reset token
    POST /api/reset-password/confirm → apply new password with token
    POST /api/update-face         → store/update face encoding

  PIN
    POST /api/verify-pin          → check PIN, track failures, block after 3
    POST /api/set-pin             → set PIN for first time (or after reset)
    POST /api/reset-pin           → reset PIN via National ID + face scan

  Transfers
    POST /api/transfer            → initiate transfer (fraud-gated)
    POST /api/calculate-fee       → fee preview before transfer
    GET  /api/transfer-history    → paginated transfer history
    POST /api/check-recipient     → lookup recipient name

  Travel
    POST /api/travel/register     → mark user as abroad (blocks transfers)
    POST /api/travel/reactivate   → re-enable after return
    GET  /api/travel/status/<phone> → check travel record

  Admin / Dashboard
    GET  /api/dashboard/stats     → system-wide statistics
    GET  /api/fraud/alerts        → unacknowledged fraud alerts
    POST /api/fraud/alerts/acknowledge → mark alert as seen
    POST /api/pin/attempt         → log PIN attempt
    GET  /api/pin/status/<phone>  → PIN security score
    GET  /api/admin/all-users     → list all users
    POST /api/admin/user-lookup   → look up user by phone

  System
    GET  /api/health              → health check
"""

import sqlite3
import os
import base64
import hashlib
import uuid as uuid_lib
from datetime import datetime
import time

from flask import Flask, request, jsonify, render_template, redirect
from flask_cors import CORS

from auth_system import AuthenticationSystem
from money_transfer import MoneyTransferSystem
from fraud_detection import (
    RealTimeFraudDetector,
    TravelMonitoringSystem,
    PinMonitoringSystem,
    UserRegistrationSystem,
)

# ─────────────────────────────────────────────────────────────────────────────
# APP SETUP
# ─────────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024   # 16 MB

DB_PATH = "mobile_money_users.db"

auth_system     = AuthenticationSystem(DB_PATH)
transfer_system = MoneyTransferSystem(DB_PATH)
fraud_detector  = RealTimeFraudDetector(DB_PATH)
user_reg        = UserRegistrationSystem(DB_PATH)
travel_system   = TravelMonitoringSystem(user_reg)
pin_monitor     = PinMonitoringSystem(user_reg)

auth_system.cleanup_expired_sessions()

provider_sessions = {}


def _ensure_access_logs_table():
    """Create access_logs table if it doesn't exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS access_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type  TEXT NOT NULL,
            identifier  TEXT,
            full_name   TEXT,
            role        TEXT,
            ip_address  TEXT,
            status      TEXT NOT NULL,
            detail      TEXT,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

_ensure_access_logs_table()


def _log_access(event_type: str, identifier: str, full_name: str,
                role: str, status: str, detail: str = ""):
    """Write one row to access_logs."""
    try:
        ip = request.remote_addr or "unknown"
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            """INSERT INTO access_logs
               (event_type, identifier, full_name, role, ip_address, status, detail)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (event_type, identifier, full_name, role, ip, status, detail)
        )
        conn.commit()
        conn.close()
    except Exception:
        pass  # never break the main flow


def _session_token() -> str | None:
    hdr = request.headers.get("Authorization", "")
    if hdr.startswith("Bearer "):
        return hdr[7:]
    return None


def _ok(data: dict, code: int = 200):
    if "success" not in data:
        data = {"success": True, **data}
    return jsonify(data), code


def _err(msg: str, code: int = 400):
    return jsonify({"success": False, "error": msg}), code


def _hash_pin(pin: str) -> str:
    """SHA-256 hash of PIN."""
    return hashlib.sha256(pin.encode()).hexdigest()


def _table_exists(conn, table: str) -> bool:
    c = conn.cursor()
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
    return c.fetchone() is not None


def _ensure_pin_columns():
    """Ensure PIN columns exist (migration-safe)."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    for col, typedef in [
        ("pin_hash",       "TEXT"),
        ("pin_blocked",    "INTEGER DEFAULT 0"),
        ("pin_fail_count", "INTEGER DEFAULT 0"),
        ("insuf_count",    "INTEGER DEFAULT 0"),
    ]:
        try:
            c.execute(f"ALTER TABLE users ADD COLUMN {col} {typedef}")
        except Exception:
            pass
    conn.commit()
    conn.close()


_ensure_pin_columns()


# ─────────────────────────────────────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return redirect("/login")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/user_dashboard")
def user_dashboard_page():
    return render_template("user_dashboard.html")

@app.route("/provider_dashboard")
def provider_dashboard_page():
    return render_template("provider_dashboard.html")

@app.route("/admin_dashboard")
def admin_dashboard_page():
    # For now, skip server-side auth check and let client handle it
    # This prevents redirect loops while debugging
    return render_template("admin_dashboard.html")


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/register", methods=["POST"])
def register():
    try:
        data        = request.get_json() or {}
        full_name   = data.get("fullName", "").strip()
        phone       = data.get("phone", "").strip()
        email       = data.get("email", "").strip()
        national_id = data.get("nationalId", "").strip()
        password    = data.get("password", "")
        face_b64    = data.get("face_base64")
        pin         = data.get("pin", "").strip()

        for field, val in [("fullName", full_name), ("phone", phone),
                           ("email", email), ("nationalId", national_id),
                           ("password", password)]:
            if not val:
                return _err(f"Missing required field: {field}")

        # Face is required at registration
        if not face_b64:
            return _err("Face scan is required during registration.")

        result = auth_system.create_account(
            phone, full_name, national_id, email, password, face_b64)
        
        # Add face validation info to response for debugging
        if result.get("success") and result.get("face_image_path"):
            result["debug_info"] = {
                "face_saved_to": result.get("face_image_path"),
                "face_size": result.get("face_size", "unknown"),
                "message": "Face image saved to uploads folder for verification"
            }

        if result["success"] and pin and len(pin) >= 4:
            # Save PIN immediately if provided during registration
            conn = sqlite3.connect(DB_PATH)
            conn.execute(
                "UPDATE users SET pin_hash=?, pin_blocked=0, pin_fail_count=0 WHERE phone_number=?",
                (_hash_pin(pin), phone)
            )
            conn.commit()
            conn.close()

        return _ok(result) if result["success"] else _err(result["error"])

    except Exception as e:
        return _err(f"Registration failed: {e}", 500)


@app.route("/api/validate-face", methods=["POST"])
def validate_face():
    """
    Validate face quality ONLY — detect + check landmarks.
    Never saves to disk or DB. Used by Reset PIN and fraud face gate.
    """
    try:
        data = request.get_json() or {}
        face_b64 = data.get("face_base64")

        if not face_b64:
            return _err("No face image provided")

        result = user_reg.validate_face_quality_only(face_b64)

        if result["error"]:
            return _err(result["error"])

        return _ok({
            "face_detected": True,
            "face_count": result.get("face_count", 1),
            "face_size": result.get("face_size", "unknown"),
            "message": "Face detected and validated"
        })

    except Exception as e:
        return _err(f"Face validation failed: {e}", 500)


@app.route("/api/login", methods=["POST"])
def login():
    try:
        data     = request.get_json() or {}
        email    = data.get("email", "").strip()
        password = data.get("password", "")

        hashed = hashlib.sha256(password.encode()).hexdigest()
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT id, name, email FROM service_providers WHERE email=? AND password=? AND is_active=1", (email, hashed))
        provider = c.fetchone()
        conn.close()

        if provider:
            import uuid
            token = str(uuid.uuid4())
            provider_sessions[token] = {
                "id": provider[0], "name": provider[1],
                "email": provider[2], "role": "provider"
            }
            _log_access("LOGIN", provider[2], provider[1], "provider", "SUCCESS")
            return _ok({
                "success": True,
                "session_token": token,
                "user": {"name": provider[1], "email": provider[2]},
                "dashboard_type": "provider",
                "dashboard_url": "/provider_dashboard"
            })

        result = auth_system.authenticate_user(password=password, email=email or None)
        if result["success"]:
            user_email = result.get("user", {}).get("email", "")
            user_name  = result.get("user", {}).get("name", "")
            is_admin = user_email.endswith("@admin.com")
            is_provider = user_email.endswith("@provider.com")
            
            if is_admin:
                role = "admin"
                result["dashboard_type"] = "admin"
                result["dashboard_url"] = "/admin_dashboard"
            elif is_provider:
                role = "provider"
                result["dashboard_type"] = "provider"
                result["dashboard_url"] = "/provider_dashboard"
            else:
                role = "user"
                result["dashboard_type"] = "user"
                result["dashboard_url"] = "/user_dashboard"

            _log_access("LOGIN", user_email, user_name, role, "SUCCESS")

            # Tell frontend if user has a PIN set
            phone = result.get("user", {}).get("phone", "")
            if phone:
                conn2 = sqlite3.connect(DB_PATH)
                row = conn2.execute(
                    "SELECT pin_hash, pin_blocked FROM users WHERE phone_number=?", (phone,)
                ).fetchone()
                conn2.close()
                result["has_pin"]    = bool(row and row[0])
                result["pin_blocked"] = bool(row and row[1])

        else:
            _log_access("LOGIN", email or "unknown", "", "unknown", "FAILED",
                        result.get("error", "Invalid credentials"))

        return _ok(result) if result["success"] else _err(result["error"], 401)

    except Exception as e:
        return _err(f"Login failed: {e}", 500)


@app.route("/api/validate-session", methods=["POST"])
def validate_session():
    try:
        data  = request.get_json() or {}
        token = data.get("session_token", "")

        if token in provider_sessions:
            provider = provider_sessions[token]
            if provider.get("role") == "provider":
                return _ok({
                    "success": True,
                    "user": {"name": provider["name"], "email": provider["email"]},
                    "dashboard_type": "provider",
                    "dashboard_url": "/provider_dashboard"
                })

        user = auth_system.validate_session(token)
        if user:
            user_email = user.get("email", "")
            is_admin = user_email.endswith("@admin.com")
            is_provider = user_email.endswith("@provider.com")
            
            if is_admin:
                dashboard_type = "admin"
                dashboard_url = "/admin_dashboard"
            elif is_provider:
                dashboard_type = "provider"
                dashboard_url = "/provider_dashboard"
            else:
                dashboard_type = "user"
                dashboard_url = "/user_dashboard"

            # Include PIN status
            phone = user.get("phone", "")
            has_pin = False
            pin_blocked = False
            if phone:
                conn = sqlite3.connect(DB_PATH)
                row = conn.execute(
                    "SELECT pin_hash, pin_blocked FROM users WHERE phone_number=?", (phone,)
                ).fetchone()
                conn.close()
                has_pin     = bool(row and row[0])
                pin_blocked  = bool(row and row[1])

            return _ok({
                "success": True,
                "user": user,
                "has_pin": has_pin,
                "pin_blocked": pin_blocked,
                "dashboard_type": dashboard_type,
                "dashboard_url": dashboard_url
            })
        return _err("Session expired or invalid.", 401)
    except Exception as e:
        return _err(f"Session validation failed: {e}", 500)


@app.route("/api/logout", methods=["POST"])
def logout():
    try:
        data  = request.get_json() or {}
        token = data.get("session_token", "") or _session_token() or ""
        # Try to find who is logging out for the log entry
        try:
            user = auth_system.validate_session(token)
            if user:
                _log_access("LOGOUT", user.get("email",""), user.get("name",""), "user", "SUCCESS")
            else:
                # Check provider sessions
                prov = provider_sessions.get(token)
                if prov:
                    _log_access("LOGOUT", prov.get("email",""), prov.get("name",""), "provider", "SUCCESS")
        except Exception:
            pass
        return _ok(auth_system.logout(token))
    except Exception as e:
        return _err(f"Logout failed: {e}", 500)


@app.route("/api/reset-password", methods=["POST"])
def request_reset():
    try:
        data  = request.get_json() or {}
        email = data.get("email", "").strip()
        if not email:
            return _err("Email is required.")
        result = auth_system.request_password_reset(email)
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Reset request failed: {e}", 500)


@app.route("/api/reset-password/confirm", methods=["POST"])
def confirm_reset():
    try:
        data     = request.get_json() or {}
        token    = data.get("token", "")
        new_pass = data.get("new_password", "")
        if not token or not new_pass:
            return _err("token and new_password are required.")
        result = auth_system.reset_password(token, new_pass)
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Password reset failed: {e}", 500)


@app.route("/api/update-face", methods=["POST"])
def update_face():
    """
    Update face for an existing user.
    Requires: phone_number + national_id (must match DB) + face_base64.
    The new face must be similar to the existing stored face (distance ≤ 0.6)
    to prevent someone else hijacking the account.
    """
    try:
        data        = request.get_json() or {}
        token       = data.get("session_token", "") or _session_token() or ""
        face_b64    = data.get("face_base64", "")
        phone_in    = data.get("phone_number", "").strip()
        national_id = data.get("national_id", "").strip()

        # ── Session required ──────────────────────────────────────────────
        user = auth_system.validate_session(token)
        if not user:
            return _err("Invalid or expired session.", 401)

        if not face_b64:
            return _err("face_base64 is required.")
        if not phone_in:
            return _err("phone_number is required.")
        if not national_id:
            return _err("national_id is required.")

        # ── Normalise phone ───────────────────────────────────────────────
        validated_phone = auth_system.validate_phone_number(phone_in)
        if not validated_phone:
            return _err("Invalid phone number format.")

        # ── Phone must belong to the session user ─────────────────────────
        if validated_phone != user["phone"]:
            return _err("Phone number does not match your account.")

        # ── Verify national_id matches DB record ──────────────────────────
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            "SELECT national_id, face_encoding, face_image_path FROM users WHERE phone_number=?",
            (validated_phone,)
        ).fetchone()
        conn.close()

        if not row:
            return _err("User not found.")

        stored_national_id, stored_face_enc, stored_face_path = row[0], row[1], row[2]

        if str(stored_national_id).strip() != str(national_id).strip():
            return _err("National ID does not match our records.")

        # ── If a face already exists, new face must be similar (same person) ──
        if stored_face_enc:
            similarity_check = user_reg.verify_face_from_base64(validated_phone, face_b64, tolerance=0.60)
            if not similarity_check.get("verified"):
                err_msg = similarity_check.get("error", "")
                # If it failed because of quality/completeness, let that error surface
                # If it failed because the face doesn't match, reject the update
                if "does not match" in (err_msg or "") or "similar" in (err_msg or "") or not err_msg:
                    return _err(
                        "Your face does not match the existing registered face on this account. "
                        "You may not be the account owner — face update rejected to protect this account. "
                        "If this is your account, try better lighting or a different angle."
                    )
                return _err(err_msg or "Face verification failed.")

        # ── Run the update — overwrites existing DB encoding + folder image ──
        result = user_reg.update_face_encoding(validated_phone, face_b64, overwrite=True)
        return _ok(result) if result["success"] else _err(result["error"])

    except Exception as e:
        return _err(f"Face update failed: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# PIN ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/set-pin", methods=["POST"])
def set_pin():
    """Set PIN for the first time (called from dashboard after login if no PIN)."""
    try:
        token = _session_token()
        if not token:
            return _err("Missing Authorization header.", 401)

        data = request.get_json() or {}
        pin  = data.get("pin", "").strip()

        if not pin or len(pin) < 4:
            return _err("PIN must be at least 4 digits.")
        if not pin.isdigit():
            return _err("PIN must contain digits only.")

        user = auth_system.validate_session(token)
        if not user:
            return _err("Invalid session.", 401)

        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "UPDATE users SET pin_hash=?, pin_blocked=0, pin_fail_count=0 WHERE phone_number=?",
            (_hash_pin(pin), user["phone"])
        )
        conn.commit()
        conn.close()

        return _ok({"success": True, "message": "PIN set successfully."})
    except Exception as e:
        return _err(f"Set PIN failed: {e}", 500)


@app.route("/api/verify-pin", methods=["POST"])
def verify_pin():
    """
    Verify transaction PIN.
    - Wrong PIN 3 times → pin_blocked = 1
    - Returns: { success, blocked, remaining }
    """
    try:
        token = _session_token()
        if not token:
            return _err("Missing Authorization header.", 401)

        data = request.get_json() or {}
        pin  = data.get("pin", "").strip()

        if not pin:
            return _err("PIN is required.")

        user = auth_system.validate_session(token)
        if not user:
            return _err("Invalid session.", 401)

        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            "SELECT pin_hash, pin_blocked, pin_fail_count FROM users WHERE phone_number=?",
            (user["phone"],)
        ).fetchone()

        if not row or not row[0]:
            conn.close()
            return _err("No PIN set. Please set your PIN first.")

        pin_hash, pin_blocked, fail_count = row

        # Already blocked
        if pin_blocked:
            conn.close()
            return _ok({"success": False, "blocked": True,
                        "error": "PIN is blocked. Go to Reset PIN to unblock."})

        # Check PIN
        if _hash_pin(pin) == pin_hash:
            # Correct — reset fail count
            conn.execute(
                "UPDATE users SET pin_fail_count=0 WHERE phone_number=?",
                (user["phone"],)
            )
            conn.commit()
            conn.close()
            return _ok({"success": True, "blocked": False})
        else:
            # Wrong PIN
            fail_count += 1
            if fail_count >= 3:
                conn.execute(
                    "UPDATE users SET pin_fail_count=3, pin_blocked=1 WHERE phone_number=?",
                    (user["phone"],)
                )
                conn.commit()
                conn.close()
                # Raise fraud alert — 3 wrong PIN attempts is suspicious
                try:
                    fraud_detector.alert_system.raise_alert(
                        user["phone"], 0, 0.85, "HIGH", "BLOCK",
                        f"PIN blocked — 3 consecutive incorrect PIN attempts. "
                        f"Possible unauthorized access attempt on account {user['phone']}."
                    )
                except Exception:
                    pass
                return _ok({
                    "success": False, "blocked": True,
                    "error": "PIN blocked after 3 incorrect attempts. Go to Reset PIN to unblock."
                })
            else:
                remaining = 3 - fail_count
                conn.execute(
                    "UPDATE users SET pin_fail_count=? WHERE phone_number=?",
                    (fail_count, user["phone"])
                )
                conn.commit()
                conn.close()
                # Alert admin on each wrong PIN attempt
                try:
                    fraud_detector.alert_system.raise_alert(
                        user["phone"], 0, 0.5 + (fail_count * 0.15), "MEDIUM", "REQUIRE_FACE",
                        f"Incorrect PIN — attempt {fail_count} of 3. "
                        f"{remaining} attempt{'s' if remaining != 1 else ''} remaining before account locks."
                    )
                except Exception:
                    pass
                return _ok({
                    "success": False, "blocked": False,
                    "remaining": remaining,
                    "error": f"Incorrect PIN. {remaining} attempt{'s' if remaining != 1 else ''} remaining."
                })

    except Exception as e:
        return _err(f"PIN verification failed: {e}", 500)


@app.route("/api/verify-identity", methods=["POST"])
def verify_identity():
    """
    Step-1 identity gate for Reset PIN and Update Face.
    Accepts phone_number + national_id and confirms they match a DB record.
    Returns { success, name } on match or { error } on mismatch.
    Does NOT require a session token — the user may be locked out.
    """
    try:
        data        = request.get_json() or {}
        phone_in    = data.get("phone_number", "").strip()
        national_id = data.get("national_id", "").strip()

        if not phone_in:
            return _err("Phone number is required.")
        if not national_id:
            return _err("National ID is required.")

        validated_phone = auth_system.validate_phone_number(phone_in)
        if not validated_phone:
            return _err("Invalid phone number format.")

        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            "SELECT full_name, national_id FROM users WHERE phone_number=?",
            (validated_phone,)
        ).fetchone()
        conn.close()

        if not row:
            return _err("No account found with this phone number.")

        stored_name, stored_nid = row[0], row[1]

        if str(stored_nid).strip() != str(national_id).strip():
            return _err("Phone number and National ID do not match our records.")

        return _ok({"success": True, "name": stored_name})

    except Exception as e:
        return _err(f"Identity verification failed: {e}", 500)


@app.route("/api/reset-pin", methods=["POST"])
def reset_pin():
    """
    Reset PIN using National ID + face scan.
    Steps:
      1. Verify session
      2. Check National ID matches user record
      3. Verify face against stored face encoding
      4. Set new PIN, unblock, reset fail count
    """
    try:
        token = _session_token()
        if not token:
            return _err("Missing Authorization header.", 401)

        data        = request.get_json() or {}
        national_id = data.get("national_id", "").strip()
        new_pin     = data.get("new_pin", "").strip()
        face_b64    = data.get("face_base64", "")

        if not national_id:
            return _err("National ID is required.")
        if not new_pin or len(new_pin) < 4:
            return _err("New PIN must be at least 4 digits.")
        if not new_pin.isdigit():
            return _err("PIN must contain digits only.")
        if not face_b64:
            return _err("Face scan is required.")

        user = auth_system.validate_session(token)
        if not user:
            return _err("Invalid session.", 401)

        # Step 1: Verify National ID matches
        conn = sqlite3.connect(DB_PATH)
        row = conn.execute(
            "SELECT national_id, face_encoding FROM users WHERE phone_number=?",
            (user["phone"],)
        ).fetchone()
        conn.close()

        if not row:
            return _err("User not found.")

        stored_national_id, stored_face_encoding = row[0], row[1]

        if str(stored_national_id).strip() != str(national_id).strip():
            return _err("National ID does not match our records.")

        # Step 2: Verify face
        if not stored_face_encoding:
            return _err("No face registered on this account. Contact support.")

        face_match = _verify_face(face_b64, stored_face_encoding)
        if not face_match["match"]:
            return _err(f"Face verification failed: {face_match['reason']}")

        # Step 3: Set new PIN, unblock
        conn = sqlite3.connect(DB_PATH)
        conn.execute(
            "UPDATE users SET pin_hash=?, pin_blocked=0, pin_fail_count=0 WHERE phone_number=?",
            (_hash_pin(new_pin), user["phone"])
        )
        conn.commit()
        conn.close()

        return _ok({"success": True, "message": "PIN reset successfully. You can now use your new PIN."})

    except Exception as e:
        return _err(f"PIN reset failed: {e}", 500)


def _verify_face(face_b64: str, stored_encoding_bytes: bytes) -> dict:
    """
    Validate face quality then compare against the stored encoding.
    Returns { match: bool, reason: str }.
    NEVER falls back to approving a face if face_recognition is unavailable —
    missing library is treated as a hard failure to prevent bypass.
    """
    try:
        import numpy as np

        # ── Step 1: Quality check ONLY — never saves to disk ────────────────
        # validate_face_quality_only runs all the same gates (brightness, size,
        # landmarks, eye openness, head upright) but never writes a file.
        # extract_face_encoding_from_base64 is ONLY used during registration.
        quality = user_reg.validate_face_quality_only(face_b64)
        if quality["error"]:
            return {"match": False, "reason": quality["error"]}

        # ── Step 2: Compare submitted encoding against stored encoding ────────
        try:
            import face_recognition
        except ImportError:
            # face_recognition library is not installed — HARD FAIL.
            # Never auto-approve: that would allow anyone to bypass face checks.
            return {
                "match": False,
                "reason": (
                    "Face verification library is not available on this server. "
                    "Face check cannot be completed — action blocked for security. "
                    "Please contact support to resolve this."
                )
            }

        submitted_encoding = np.frombuffer(quality["encoding"], dtype=np.float64)
        if len(submitted_encoding) != 128:
            submitted_encoding = np.frombuffer(quality["encoding"], dtype=np.float32).astype(np.float64)

        stored_encoding = np.frombuffer(stored_encoding_bytes, dtype=np.float64)
        if len(stored_encoding) != 128:
            stored_encoding = np.frombuffer(stored_encoding_bytes, dtype=np.float32).astype(np.float64)
        if len(stored_encoding) != 128:
            return {"match": False, "reason": "Stored face encoding is corrupted. Contact support."}

        distance = face_recognition.face_distance([stored_encoding], submitted_encoding)[0]
        if distance <= 0.55:
            return {"match": True, "reason": f"Face matched (distance: {distance:.3f})"}
        else:
            return {
                "match": False,
                "reason": (
                    "Your face does not match the registered face on this account. "
                    "Try better lighting, remove glasses, or face the camera directly. "
                    "If you are not the account owner, this action is not allowed."
                )
            }

    except Exception as e:
        return {"match": False, "reason": f"Verification error: {e}"}


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFER ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/transfer", methods=["POST"])
def transfer():
    try:
        token = _session_token()
        if not token:
            return _err("Missing Authorization header.", 401)

        data            = request.get_json() or {}
        recipient_phone = data.get("recipient_phone", "").strip()
        amount_raw      = data.get("amount", 0)
        transfer_type   = data.get("transfer_type", "mobile_money")
        face_b64        = data.get("face_base64")

        try:
            amount = float(amount_raw)
        except (TypeError, ValueError):
            return _err("Invalid amount.")

        result = transfer_system.initiate_transfer(
            session_token   = token,
            recipient_phone = recipient_phone,
            amount          = amount,
            transfer_type   = transfer_type,
            face_base64     = face_b64,
        )
        code = 200 if result.get("success") or result.get("face_required") else 400
        return _ok(result, code)

    except Exception as e:
        return _err(f"Transfer failed: {e}", 500)


@app.route("/api/calculate-fee", methods=["POST"])
def calculate_fee():
    try:
        data   = request.get_json() or {}
        phone  = data.get("phone", "").strip()
        amount = float(data.get("amount", 0))
        result = transfer_system.get_transfer_fee(phone, amount)
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Fee calculation failed: {e}", 500)


@app.route("/api/transfer-history", methods=["GET"])
def transfer_history():
    try:
        token = _session_token()
        if not token:
            return _err("Missing Authorization header.", 401)
        limit  = request.args.get("limit", 50, type=int)
        result = transfer_system.get_transfer_history(token, limit)
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Failed to fetch history: {e}", 500)


@app.route("/api/check-recipient", methods=["POST"])
def check_recipient():
    try:
        data  = request.get_json() or {}
        phone = data.get("phone", "").strip()
        if not phone:
            return _err("Phone number required.")

        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()
        c.execute("SELECT full_name, is_active FROM users WHERE phone_number=?", (phone,))
        row = c.fetchone()

        if not row:
            conn.close()
            return _ok({"success": True, "registered": False})

        full_name, is_active = row[0], bool(row[1])

        if not is_active:
            import datetime
            today = datetime.date.today().isoformat()
            c.execute("""
                SELECT destination_country, return_date FROM travel_records
                WHERE user_phone=?
                  AND date(departure_date) <= date(?)
                  AND date(return_date)    >= date(?)
                ORDER BY id DESC LIMIT 1
            """, (phone, today, today))
            travel = c.fetchone()
            conn.close()
            if travel:
                return _ok({"success": True, "registered": True, "name": full_name,
                            "blocked": True,
                            "blocked_reason": f"✈️ Recipient is abroad in {travel[0]} until {travel[1]}."})
            return _ok({"success": True, "registered": True, "name": full_name,
                        "blocked": True, "blocked_reason": "This account is deactivated."})

        conn.close()
        return _ok({"success": True, "registered": True, "name": full_name, "blocked": False})
    except Exception as e:
        return _err(f"Recipient lookup failed: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# TRAVEL ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/travel/register", methods=["POST"])
def register_travel():
    try:
        data = request.get_json() or {}
        for f in ("phone_number", "departure_date", "return_date", "destination_country"):
            if not data.get(f):
                return _err(f"Missing required field: {f}")
        result = travel_system.register_travel(
            data["phone_number"], data["departure_date"],
            data["return_date"], data["destination_country"])
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Travel registration failed: {e}", 500)


@app.route("/api/travel/reactivate", methods=["POST"])
def reactivate_sim():
    try:
        data  = request.get_json() or {}
        phone = data.get("phone_number", "").strip()
        if not phone:
            return _err("phone_number required.")
        result = travel_system.reactivate_on_return(phone)
        return _ok(result) if result["success"] else _err(result["error"])
    except Exception as e:
        return _err(f"Reactivation failed: {e}", 500)


@app.route("/api/travel/status/<phone>", methods=["GET"])
def travel_status(phone):
    try:
        return _ok({"success": True, "travel": travel_system.get_travel_status(phone)})
    except Exception as e:
        return _err(f"Travel status failed: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN / DASHBOARD ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/dashboard/stats", methods=["GET"])
def dashboard_stats():
    try:
        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()

        def q(sql, *args):
            c.execute(sql, args)
            return c.fetchone()[0]

        stats = {
            "total_users"            : q("SELECT COUNT(*) FROM users WHERE email NOT LIKE '%@admin.com'"),
            "active_users"           : q("SELECT COUNT(*) FROM users WHERE is_active=1"),
            "active_providers"       : q("SELECT COUNT(*) FROM service_providers WHERE is_active=1"),
            "users_abroad"           : q(
                "SELECT COUNT(*) FROM travel_records "
                "WHERE departure_date<=datetime('now') AND return_date>=datetime('now')"),
            "transfers_today"        : q(
                "SELECT COUNT(*) FROM money_transfers "
                "WHERE date(created_at)=date('now')"),
            "transfers_7d"           : q(
                "SELECT COUNT(*) FROM money_transfers "
                "WHERE created_at>=datetime('now','-7 days')"),
            "fraud_blocked_7d"       : q(
                "SELECT COUNT(*) FROM money_transfers "
                "WHERE is_fraud=1 AND created_at>=datetime('now','-7 days')"),
            "face_verified_transfers": q(
                "SELECT COUNT(*) FROM money_transfers WHERE face_verified=1"),
            "total_volume_7d"        : q(
                "SELECT COALESCE(SUM(amount),0) FROM money_transfers "
                "WHERE status='completed' AND created_at>=datetime('now','-7 days')"),
            "fraud_alerts"           : q(
                "SELECT COUNT(*) FROM fraud_alerts WHERE acknowledged=0")
                if _table_exists(conn, "fraud_alerts") else 0,
        }

        transfers_7d = stats["transfers_7d"] or 1
        stats["fraud_rate_7d"] = round(stats["fraud_blocked_7d"] / transfers_7d * 100, 2)

        conn.close()
        return _ok({"success": True, "stats": stats})
    except Exception as e:
        return _err(f"Stats failed: {e}", 500)


@app.route("/api/fraud/alerts", methods=["GET"])
def fraud_alerts():
    try:
        alerts = fraud_detector.get_fraud_alerts()
        return _ok({"success": True, "alerts": alerts})
    except Exception as e:
        return _err(f"Failed to fetch alerts: {e}", 500)


@app.route("/api/fraud/alerts/acknowledge", methods=["POST"])
def acknowledge_alert():
    try:
        data     = request.get_json() or {}
        alert_id = data.get("alert_id")
        if not alert_id:
            return _err("alert_id required.")
        result = fraud_detector.acknowledge_alert(int(alert_id))
        return _ok(result)
    except Exception as e:
        return _err(f"Acknowledge failed: {e}", 500)


@app.route("/api/pin/attempt", methods=["POST"])
def pin_attempt():
    try:
        data = request.get_json() or {}
        if not data.get("phone_number") or "was_successful" not in data:
            return _err("phone_number and was_successful required.")
        result = pin_monitor.record_pin_attempt(
            data["phone_number"], bool(data["was_successful"]),
            data.get("ip_address"), data.get("device_id"))
        return _ok(result)
    except Exception as e:
        return _err(f"PIN attempt logging failed: {e}", 500)


@app.route("/api/pin/status/<phone>", methods=["GET"])
def pin_status(phone):
    try:
        status = pin_monitor.get_pin_security_status(phone)
        return _ok({"success": True, "pin_security": status})
    except Exception as e:
        return _err(f"PIN status failed: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN USER MANAGEMENT ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/admin/user-lookup", methods=["POST"])
def admin_user_lookup():
    try:
        data  = request.get_json() or {}
        phone = data.get("phone_number", "").strip()
        if not phone:
            return _err("phone_number required.")

        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()

        c.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in c.fetchall()]

        if "full_name" in columns and "phone_number" in columns:
            c.execute(
                "SELECT full_name, phone_number, email, national_id, account_balance, is_active "
                "FROM users WHERE phone_number=?", (phone,))
        else:
            c.execute("SELECT * FROM users WHERE phone_number=?", (phone,))

        user_row = c.fetchone()
        if not user_row:
            conn.close()
            return _err("User not found.")

        user = {
            "name": user_row[0], "phone": user_row[1],
            "email": user_row[2] if len(user_row) > 2 else "",
            "national_id": user_row[3] if len(user_row) > 3 else "",
            "balance": user_row[4] if len(user_row) > 4 else 0,
            "is_active": bool(user_row[5]) if len(user_row) > 5 else True
        }

        try:
            c.execute(
                "SELECT u2.phone_number, mt.recipient_phone, mt.amount, COALESCE(mt.fee,0), "
                "mt.status, mt.created_at, mt.fraud_score, mt.risk_level, mt.is_fraud, "
                "mt.notes, 'sent' "
                "FROM money_transfers mt JOIN users u2 ON mt.sender_id=u2.id "
                "WHERE u2.phone_number=? ORDER BY mt.created_at DESC LIMIT 20", (phone,))
            sent_rows = c.fetchall()
            c.execute(
                "SELECT u2.phone_number, mt.recipient_phone, mt.amount, 0, mt.status, "
                "mt.created_at, mt.fraud_score, mt.risk_level, mt.is_fraud, mt.notes, 'received' "
                "FROM money_transfers mt JOIN users u2 ON mt.sender_id=u2.id "
                "WHERE mt.recipient_phone=? AND mt.status='completed' "
                "ORDER BY mt.created_at DESC LIMIT 20", (phone,))
            recv_rows = c.fetchall()
            all_rows = sorted(list(sent_rows) + list(recv_rows), key=lambda x: x[5] or "", reverse=True)
            user["transactions"] = [{
                "sender_phone": r[0], "recipient_phone": r[1], "amount": r[2],
                "fee": r[3], "status": r[4], "created_at": r[5],
                "fraud_score": r[6], "risk_level": r[7], "is_fraud": bool(r[8]),
                "notes": r[9], "direction": r[10]
            } for r in all_rows[:20]]
        except Exception:
            user["transactions"] = []

        if _table_exists(conn, "fraud_alerts"):
            try:
                c.execute(
                    "SELECT message, fraud_score, risk_level, action, created_at "
                    "FROM fraud_alerts WHERE phone_number=? "
                    "ORDER BY created_at DESC LIMIT 10", (phone,))
                user["alerts"] = [{"message": r[0], "fraud_score": r[1],
                                   "risk_level": r[2], "action": r[3], "created_at": r[4]}
                                  for r in c.fetchall()]
            except Exception:
                user["alerts"] = []

        conn.close()
        return _ok({"success": True, "user": user})
    except Exception as e:
        return _err(f"User lookup failed: {e}", 500)


@app.route("/api/admin/all-users", methods=["GET"])
def admin_all_users():
    try:
        conn = sqlite3.connect(DB_PATH)
        c    = conn.cursor()
        c.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in c.fetchall()]
        order_col = "registration_date" if "registration_date" in columns else "id"

        if "full_name" in columns and "phone_number" in columns:
            c.execute(f"SELECT full_name, phone_number, email, account_balance, is_active, national_id, sex "
                      f"FROM users WHERE email NOT LIKE '%@admin.com' ORDER BY {order_col} DESC")
            users = [{"full_name": r[0], "phone_number": r[1], "email": r[2] if len(r)>2 else "",
                      "account_balance": r[3] if len(r)>3 else 0, "is_active": bool(r[4]) if len(r)>4 else True,
                      "national_id": r[5] if len(r)>5 else "", "sex": r[6] if len(r)>6 else ""}
                     for r in c.fetchall()]
        else:
            c.execute(f"SELECT * FROM users WHERE email NOT LIKE '%@admin.com' ORDER BY {order_col} DESC")
            users = [{"full_name": r[1] if len(r)>1 else "Unknown", "phone_number": r[2] if len(r)>2 else "Unknown",
                      "email": r[3] if len(r)>3 else "", "account_balance": r[4] if len(r)>4 else 0,
                      "is_active": bool(r[5]) if len(r)>5 else True}
                     for r in c.fetchall()]
        conn.close()
        return _ok({"success": True, "users": users})
    except Exception as e:
        return _err(f"Failed to fetch users: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN PROVIDER MANAGEMENT ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/admin/providers", methods=["GET"])
def admin_get_providers():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("PRAGMA table_info(service_providers)")
        columns = [row[1] for row in c.fetchall()]
        
        # Build query based on available columns
        select_cols = ["id", "name", "email"]
        if "phone" in columns:
            select_cols.append("phone")
        if "national_id" in columns:
            select_cols.append("national_id")
        if "sex" in columns:
            select_cols.append("sex")
        select_cols.extend(["is_active", "created_at"])
        
        c.execute(f"SELECT {', '.join(select_cols)} FROM service_providers ORDER BY created_at DESC")
        
        providers = []
        for row in c.fetchall():
            provider = {
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "is_active": bool(row[select_cols.index("is_active")]),
                "created_date": row[select_cols.index("created_at")]
            }
            if "phone" in select_cols:
                provider["phone"] = row[select_cols.index("phone")]
            if "national_id" in select_cols:
                provider["national_id"] = row[select_cols.index("national_id")]
            if "sex" in select_cols:
                provider["sex"] = row[select_cols.index("sex")]
            providers.append(provider)
        
        conn.close()
        return _ok({"success": True, "providers": providers})
    except Exception as e:
        return _err(f"Failed to fetch providers: {e}", 500)


@app.route("/api/admin/add-provider", methods=["POST"])
def admin_add_provider():
    try:
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        phone = data.get("phone", "").strip()
        national_id = data.get("national_id", "").strip()
        sex = data.get("sex", "").strip()
        status = data.get("status", "1")
        password = data.get("password", "")
        
        if not all([name, email, password]):
            return _err("Name, email, and password are required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if email already exists
        c.execute("SELECT id FROM service_providers WHERE email=?", (email,))
        if c.fetchone():
            conn.close()
            return _err("Email already exists.")
        
        # Hash password
        import hashlib
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        
        # Insert provider
        c.execute(
            "INSERT INTO service_providers (name, email, phone, national_id, sex, password, is_active, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            (name, email, phone, national_id, sex, hashed_password, int(status))
        )
        
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "Provider added successfully"
        })
    except Exception as e:
        return _err(f"Failed to add provider: {e}", 500)


@app.route("/api/admin/toggle-provider", methods=["POST"])
def admin_toggle_provider():
    try:
        data = request.get_json() or {}
        provider_id = data.get("provider_id")
        
        if not provider_id:
            return _err("Provider ID is required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Get current status
        c.execute("SELECT is_active FROM service_providers WHERE id=?", (provider_id,))
        result = c.fetchone()
        if not result:
            conn.close()
            return _err("Provider not found.")
        
        # Toggle status
        new_status = 0 if result[0] == 1 else 1
        c.execute("UPDATE service_providers SET is_active=? WHERE id=?", (new_status, provider_id))
        conn.commit()
        conn.close()
        
        status_text = "activated" if new_status == 1 else "deactivated"
        return _ok({
            "success": True,
            "message": f"Provider {status_text} successfully"
        })
    except Exception as e:
        return _err(f"Failed to toggle provider: {e}", 500)


@app.route("/api/admin/update-provider", methods=["POST"])
def admin_update_provider():
    try:
        data = request.get_json() or {}
        provider_id = data.get("provider_id")
        name = data.get("name", "").strip()
        email = data.get("email", "").strip()
        phone = data.get("phone", "").strip()
        national_id = data.get("national_id", "").strip()
        sex = data.get("sex", "").strip()
        status = data.get("status", "1")
        password = data.get("password", "")
        
        if not all([provider_id, name, email]):
            return _err("Provider ID, name, and email are required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if provider exists
        c.execute("SELECT id FROM service_providers WHERE id=?", (provider_id,))
        if not c.fetchone():
            conn.close()
            return _err("Provider not found.")
        
        # Check if email is already used by another provider
        c.execute("SELECT id FROM service_providers WHERE email=? AND id!=?", (email, provider_id))
        if c.fetchone():
            conn.close()
            return _err("Email is already used by another provider.")
        
        # Update provider
        if password:
            # Update with new password
            import hashlib
            hashed_password = hashlib.sha256(password.encode()).hexdigest()
            c.execute(
                "UPDATE service_providers SET name=?, email=?, phone=?, national_id=?, sex=?, password=?, is_active=? WHERE id=?",
                (name, email, phone, national_id, sex, hashed_password, int(status), provider_id)
            )
        else:
            # Update without changing password
            c.execute(
                "UPDATE service_providers SET name=?, email=?, phone=?, national_id=?, sex=?, is_active=? WHERE id=?",
                (name, email, phone, national_id, sex, int(status), provider_id)
            )
        
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "Provider updated successfully"
        })
    except Exception as e:
        return _err(f"Failed to update provider: {e}", 500)


@app.route("/api/admin/delete-provider", methods=["POST"])
def admin_delete_provider():
    try:
        data = request.get_json() or {}
        provider_id = data.get("provider_id")
        
        if not provider_id:
            return _err("Provider ID is required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Delete provider
        c.execute("DELETE FROM service_providers WHERE id=?", (provider_id,))
        if c.rowcount == 0:
            conn.close()
            return _err("Provider not found.")
        
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "Provider deleted successfully"
        })
    except Exception as e:
        return _err(f"Failed to delete provider: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN USER MANAGEMENT ROUTES (EXTENDED)
@app.route("/api/admin/access-logs", methods=["GET"])
def admin_get_access_logs():
    try:
        limit = min(int(request.args.get("limit", 100)), 500)
        conn = sqlite3.connect(DB_PATH)
        _ensure_access_logs_table()
        c = conn.cursor()
        c.execute("""
            SELECT id, event_type, identifier, full_name, role,
                   ip_address, status, detail, created_at
            FROM access_logs
            ORDER BY created_at DESC
            LIMIT ?
        """, (limit,))
        rows = c.fetchall()
        conn.close()
        logs = [
            {
                "id":         row[0],
                "event_type": row[1],
                "identifier": row[2] or "",
                "full_name":  row[3] or "Unknown",
                "role":       row[4] or "",
                "ip_address": row[5] or "",
                "status":     row[6],
                "detail":     row[7] or "",
                "created_at": row[8]
            }
            for row in rows
        ]
        return _ok({"success": True, "logs": logs})
    except Exception as e:
        return _err(f"Failed to fetch access logs: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/admin/fraud-alerts", methods=["GET"])
def admin_get_fraud_alerts():
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()

        if not _table_exists(conn, "fraud_alerts"):
            conn.close()
            return _ok({"success": True, "alerts": []})

        c.execute("""
            SELECT
                fa.id,
                fa.phone_number,
                fa.amount,
                fa.fraud_score,
                fa.risk_level,
                fa.action,
                fa.alert_message,
                fa.acknowledged,
                fa.created_at,
                u.full_name
            FROM fraud_alerts fa
            LEFT JOIN users u ON fa.phone_number = u.phone_number
            ORDER BY fa.created_at DESC
            LIMIT 100
        """)

        alerts = [
            {
                "id": row[0],
                "phone_number": row[1],
                "amount": row[2],
                "fraud_score": row[3],
                "risk_level": row[4],
                "action": row[5],
                "message": row[6],
                "acknowledged": bool(row[7]),
                "created_at": row[8],
                "user_name": row[9] or "Unknown"
            }
            for row in c.fetchall()
        ]

        conn.close()
        return _ok({
            "success": True,
            "alerts": alerts
        })
    except Exception as e:
        return _err(f"Failed to fetch fraud alerts: {e}", 500)


@app.route("/api/admin/update-user-multi", methods=["POST"])
def admin_update_user_multi():
    try:
        data = request.get_json() or {}
        phone = data.get("phone_number", "").strip()
        full_name = data.get("full_name", "").strip()
        email = data.get("email", "").strip()
        national_id = data.get("national_id", "").strip()
        sex = data.get("sex", "").strip()
        account_balance = data.get("account_balance")
        is_active = data.get("is_active")
        
        if not all([phone, full_name]):
            return _err("Phone number and full name are required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if user exists
        c.execute("SELECT phone_number FROM users WHERE phone_number=?", (phone,))
        if not c.fetchone():
            conn.close()
            return _err("User not found.")
        
        # Update user with multiple fields
        update_fields = []
        update_values = []
        
        update_fields.append("full_name=?")
        update_values.append(full_name)
        
        if email is not None:
            update_fields.append("email=?")
            update_values.append(email)
        
        if national_id is not None:
            update_fields.append("national_id=?")
            update_values.append(national_id)
        
        if sex is not None:
            update_fields.append("sex=?")
            update_values.append(sex)
        
        if account_balance is not None:
            update_fields.append("account_balance=?")
            update_values.append(account_balance)
        
        if is_active is not None:
            update_fields.append("is_active=?")
            update_values.append(1 if is_active else 0)
        
        update_values.append(phone)  # For WHERE clause
        
        c.execute(f"UPDATE users SET {', '.join(update_fields)} WHERE phone_number=?", update_values)
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "User updated successfully"
        })
    except Exception as e:
        return _err(f"Failed to update user: {e}", 500)


@app.route("/api/admin/update-user", methods=["POST"])
def admin_update_user():
    try:
        data = request.get_json() or {}
        phone = data.get("phone_number", "").strip()
        field = data.get("field", "").strip()
        value = data.get("value")
        
        if not all([phone, field]):
            return _err("Phone number and field are required.")
        
        valid_fields = ["full_name", "email", "account_balance", "is_active"]
        if field not in valid_fields:
            return _err(f"Invalid field. Must be one of: {', '.join(valid_fields)}")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Check if user exists
        c.execute("SELECT phone_number FROM users WHERE phone_number=?", (phone,))
        if not c.fetchone():
            conn.close()
            return _err("User not found.")
        
        # Update user
        if field == "is_active":
            value = 1 if value else 0
        
        c.execute(f"UPDATE users SET {field}=? WHERE phone_number=?", (value, phone))
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "User updated successfully"
        })
    except Exception as e:
        return _err(f"Failed to update user: {e}", 500)


@app.route("/api/admin/delete-user", methods=["POST"])
def admin_delete_user():
    try:
        data = request.get_json() or {}
        phone = data.get("phone_number", "").strip()
        
        if not phone:
            return _err("Phone number is required.")
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        
        # Delete user
        c.execute("DELETE FROM users WHERE phone_number=?", (phone,))
        if c.rowcount == 0:
            conn.close()
            return _err("User not found.")
        
        conn.commit()
        conn.close()
        
        return _ok({
            "success": True,
            "message": "User deleted successfully"
        })
    except Exception as e:
        return _err(f"Failed to delete user: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN SYSTEM MANAGEMENT ROUTES
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/admin/backup", methods=["POST"])
def admin_create_backup():
    try:
        import shutil
        from datetime import datetime
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"backup_{timestamp}.db"
        
        # Create backup
        shutil.copy2(DB_PATH, backup_path)
        
        return _ok({
            "success": True,
            "message": "Backup created successfully",
            "backup_file": backup_path
        })
    except Exception as e:
        return _err(f"Failed to create backup: {e}", 500)


@app.route("/api/admin/system-stats", methods=["GET"])
def admin_system_stats():
    try:
        import os
        
        # Database size
        db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        db_size_mb = round(db_size / (1024 * 1024), 2)
        
        # Active sessions
        active_user_sessions = len(auth_system.sessions)
        active_provider_sessions = len(provider_sessions)
        
        # System uptime (simplified)
        uptime_seconds = 3600  # Placeholder
        
        return _ok({
            "success": True,
            "stats": {
                "database_size_mb": db_size_mb,
                "active_user_sessions": active_user_sessions,
                "active_provider_sessions": active_provider_sessions,
                "uptime_seconds": uptime_seconds,
                "system_status": "healthy"
            }
        })
    except Exception as e:
        return _err(f"Failed to get system stats: {e}", 500)


# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    return _ok({
        "status"   : "healthy",
        "timestamp": datetime.now().isoformat(),
        "version"  : "2.0.0",
        "ml_model" : fraud_detector.config.get("best_model", "not loaded"),
    })


@app.errorhandler(404)
def not_found(e):
    return _err("Endpoint not found.", 404)

@app.errorhandler(413)
def too_large(e):
    return _err("File too large (max 16 MB).", 413)

@app.errorhandler(500)
def server_error(e):
    return _err("Internal server error.", 500)


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("  Mobile Money Fraud Detection API  v2.0")
    print("=" * 60)
    print(f"  URL      : http://localhost:5000")
    print(f"  Health   : http://localhost:5000/api/health")
    print(f"  Dashboard: http://localhost:5000/user_dashboard")
    print(f"  ML Model : {fraud_detector.config.get('best_model', 'not loaded')}")
    print("=" * 60)
    app.run(debug=False, host="0.0.0.0", port=5000)
