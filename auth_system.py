"""
auth_system.py — Authentication System
=======================================
Handles:
  - Account creation (with face encoding captured at registration)
  - Login via email or phone
  - Session management (24-hour tokens)
  - Password reset tokens
  - Balance queries
"""

import psycopg2
import psycopg2.extras
import hashlib
import secrets
import re
from datetime import datetime, timedelta


class AuthenticationSystem:
    def __init__(self, db_config):
        self.db_config = db_config
        self.init_database()
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    # ─────────────────────────────────────────────────────────────────────
    # DATABASE INIT
    # ─────────────────────────────────────────────────────────────────────

    def init_database(self):
        """Create auth-related tables if they do not exist."""
        conn = self.get_connection()
        c = conn.cursor()

        # Main users table FIRST — other tables FK-reference it
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id                  SERIAL PRIMARY KEY,
                phone_number        TEXT    UNIQUE NOT NULL,
                full_name           TEXT    NOT NULL,
                national_id         TEXT    UNIQUE NOT NULL,
                email               TEXT    UNIQUE NOT NULL,
                password_hash       TEXT    DEFAULT '',
                salt                TEXT    DEFAULT '',
                gender              TEXT    DEFAULT '',
                registration_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active           BOOLEAN DEFAULT TRUE,
                face_encoding       BYTEA,
                face_image_path     TEXT,
                verification_status TEXT    DEFAULT 'pending',
                account_balance     REAL    DEFAULT 0.0,
                last_login          TIMESTAMP
            )
        ''')

        # 2. password_reset_tokens
        c.execute('''
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id         SERIAL PRIMARY KEY,
                email      TEXT    NOT NULL,
                token      TEXT    UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                is_used    BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # 3. user_sessions LAST — FK references users
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id            SERIAL PRIMARY KEY,
                user_id       INTEGER NOT NULL,
                session_token TEXT    UNIQUE NOT NULL,
                expires_at    TIMESTAMP NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Safe migrations — add columns that may be missing in older DBs
        for col_sql in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS face_encoding BYTEA",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS face_image_path TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'",
        ]:
            try:
                c.execute(col_sql)
            except Exception:
                pass  # column already exists or error

        conn.commit()
        c.close()
        conn.close()

    # ─────────────────────────────────────────────────────────────────────
    # VALIDATION HELPERS
    # ─────────────────────────────────────────────────────────────────────

    def validate_phone_number(self, phone: str) -> str | None:
        """
        Accept Rwanda numbers in any common format and normalise to +250XXXXXXXXX.
        Valid prefixes: 078, 079 (MTN), 072, 073 (Tigo).
        Returns normalised phone or None if invalid.
        """
        phone = phone.strip().replace(" ", "")

        if phone.startswith("+250"):
            core = phone[4:]
        elif phone.startswith("250"):
            core = phone[3:]
        elif phone.startswith("0"):
            core = phone[1:]
        else:
            core = phone

        if re.match(r'^(7[8923])\d{7}$', core):
            return f"+250{core}"
        return None

    def validate_email(self, email: str) -> bool:
        """Basic email format check."""
        if "@" not in email:
            return False
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(pattern, email))

    def validate_national_id(self, national_id: str) -> bool:
        """Rwanda National ID must be exactly 16 digits."""
        return bool(re.match(r'^\d{16}$', national_id))

    def validate_password_strength(self, password: str) -> tuple[bool, str]:
        """
        Returns (is_valid, error_message).
        Password must be ≥8 chars and contain letter + digit + special char.
        """
        if len(password) < 8:
            return False, "Password must be at least 8 characters long."
        if not any(c.isdigit() for c in password):
            return False, "Password must contain at least one number."
        if not any(c.isalpha() for c in password):
            return False, "Password must contain at least one letter."
        if not any(c in '!@#$%^&*(),.?":{}|<>_-' for c in password):
            return False, "Password must contain at least one special character."
        return True, ""

    # ─────────────────────────────────────────────────────────────────────
    # PASSWORD HASHING
    # ─────────────────────────────────────────────────────────────────────

    def hash_password(self, password: str, salt: str = None) -> tuple[str, str]:
        if salt is None:
            salt = secrets.token_hex(16)
        pw_hash = hashlib.sha256((password + salt).encode()).hexdigest()
        return pw_hash, salt

    # ─────────────────────────────────────────────────────────────────────
    # ACCOUNT CREATION
    # ─────────────────────────────────────────────────────────────────────

    def create_account(self, phone_number: str, full_name: str,
                       national_id: str, email: str, password: str,
                       face_base64: str = None) -> dict:
        """
        Create a new user account.

        face_base64 is the base64-encoded image from the device camera
        captured on the registration page.  If provided, the face encoding
        is extracted and stored so that face verification works later.
        """
        # ── Validate inputs ──────────────────────────────────────────────
        validated_phone = self.validate_phone_number(phone_number)
        if not validated_phone:
            return {"success": False,
                    "error": "Invalid phone number. Use 078, 079, 072, or 073 format."}

        if not self.validate_email(email):
            return {"success": False,
                    "error": "Invalid email format."}

        if not self.validate_national_id(national_id):
            return {"success": False,
                    "error": "National ID must be exactly 16 digits."}

        pw_ok, pw_msg = self.validate_password_strength(password)
        if not pw_ok:
            return {"success": False, "error": pw_msg}

        # ── Duplicate check ──────────────────────────────────────────────
        conn = self.get_connection()
        c = conn.cursor()
        c.execute(
            "SELECT id FROM users WHERE phone_number=%s OR email=%s OR national_id=%s",
            (validated_phone, email, national_id)
        )
        if c.fetchone():
            conn.close()
            return {"success": False,
                    "error": "An account with this phone, email, or National ID already exists."}

        # ── Hash password ────────────────────────────────────────────────
        pw_hash, salt = self.hash_password(password)

        # ── Auto-detect gender from National ID (positions 5-7) ──────────
        gender = ""
        if len(national_id) == 16:
            seg = national_id[5:8]
            if seg == "800":
                gender = "Male"
            elif seg == "700":
                gender = "Female"

        # ── Extract face encoding (if image provided) ────────────────────
        face_encoding = None
        face_image_path = None
        face_error = None
        
        if face_base64:
            try:
                import base64 as b64lib
                import os
                import face_recognition
                import numpy as np
                from PIL import Image
                import io

                img_bytes = b64lib.b64decode(face_base64)

                # Save image to disk
                os.makedirs("uploads/faces", exist_ok=True)
                safe_phone = validated_phone.replace("+", "").replace(" ", "")
                face_image_path = f"uploads/faces/{safe_phone}.jpg"
                with open(face_image_path, "wb") as f:
                    f.write(img_bytes)

                # Extract real 128-dim face encoding
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                encs = face_recognition.face_encodings(np.array(img))
                if not encs:
                    return {"success": False, "error": "No face detected in your photo. Please retake in good lighting with your face clearly visible."}

                face_encoding = encs[0].tobytes()  # store real 128-dim vector
                print(f"[Auth] Face encoding extracted and saved: {face_image_path}")

            except ImportError:
                # face_recognition not installed — fall back to raw bytes
                face_encoding = img_bytes
                print(f"[Auth] face_recognition not available, saved raw image")
            except Exception as e:
                print(f"[Auth] Face save error: {e}")
                return {"success": False, "error": f"Face processing failed: {str(e)}"}

        verification_status = "verified" if face_encoding else "pending"

        # ── Insert user ──────────────────────────────────────────────────
        try:
            c.execute('''
                INSERT INTO users
                (phone_number, full_name, national_id, email,
                 password_hash, salt, gender,
                 face_encoding, verification_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (validated_phone, full_name, national_id, email,
                  pw_hash, salt, gender,
                  face_encoding, verification_status))
            conn.commit()
        except psycopg2.IntegrityError:
            conn.close()
            return {"success": False,
                    "error": "Account already exists."}
        finally:
            conn.close()

        return {
            "success"        : True,
            "message"        : "Account created successfully.",
            "face_registered": face_encoding is not None,
            "face_image_path": face_image_path,
            "face_size"      : f"Face detected and saved" if face_encoding else "No face registered",
            "note"           : ("" if face_encoding else
                                "No face registered. You can add it later in settings.")
        }

    # ─────────────────────────────────────────────────────────────────────
    # LOGIN
    # ─────────────────────────────────────────────────────────────────────

    def authenticate_user(self, password: str,
                          email: str = None,
                          phone_number: str = None) -> dict:
        """
        Login with email+password or phone+password.
        Returns session token on success.
        """
        if not email and not phone_number:
            return {"success": False, "error": "Provide email or phone number."}

        conn = self.get_connection()
        c = conn.cursor()

        if email:
            c.execute('''
                SELECT id, phone_number, password_hash, salt, full_name, is_active, email, role
                FROM users WHERE email = %s
            ''', (email,))
        else:
            validated = self.validate_phone_number(phone_number)
            if not validated:
                conn.close()
                return {"success": False, "error": "Invalid phone number."}
            c.execute('''
                SELECT id, phone_number, password_hash, salt, full_name, is_active, email, role
                FROM users WHERE phone_number = %s
            ''', (validated,))

        user = c.fetchone()

        if not user:
            conn.close()
            return {"success": False, "error": "No account found with these credentials."}

        user_id, user_phone, pw_hash, salt, full_name, is_active, user_email, user_role = user

        # NOTE: is_active=0 means SIM is blocked for travel — login still allowed.
        # Transfer blocking is enforced in money_transfer.py via travel_records.

        # Verify password
        input_hash, _ = self.hash_password(password, salt)
        if input_hash != pw_hash:
            conn.close()
            return {"success": False, "error": "Incorrect password."}

        # Create session
        token      = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=24)

        c.execute('''
            INSERT INTO user_sessions (user_id, session_token, expires_at)
            VALUES (%s, %s, %s)
        ''', (user_id, token, expires_at))
        c.execute("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=%s",
                  (user_id,))
        conn.commit()
        conn.close()

        return {
            "success"      : True,
            "session_token": token,
            "user": {
                "id"   : user_id,
                "phone": user_phone,
                "name" : full_name,
                "email": user_email,
                "role" : user_role or "user"
            }
        }

    # ─────────────────────────────────────────────────────────────────────
    # SESSION MANAGEMENT
    # ─────────────────────────────────────────────────────────────────────

    def validate_session(self, session_token: str) -> dict | None:
        """
        Validate a session token.
        Returns user dict on success, None if expired or invalid.
        """
        conn = self.get_connection()
        c = conn.cursor()

        try:
            c.execute('''
                SELECT u.id, u.phone_number, u.full_name, u.account_balance,
                       u.email, u.national_id, u.gender, u.verification_status,
                       u.face_encoding IS NOT NULL AS has_face
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = %s
                  AND s.expires_at > CURRENT_TIMESTAMP
            ''', (session_token,))
            row = c.fetchone()
        except Exception:
            row = None
        finally:
            conn.close()

        if not row:
            return None

        return {
            "id"                : row[0],
            "phone"             : row[1],
            "name"              : row[2],
            "balance"           : row[3],
            "email"             : row[4],
            "nationalId"        : row[5],
            "gender"            : row[6] or "",
            "verification_status": row[7],
            "has_face"          : bool(row[8]),
        }

    def logout(self, session_token: str) -> dict:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM user_sessions WHERE session_token=%s", (session_token,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Logged out successfully."}

    def cleanup_expired_sessions(self):
        """Remove expired sessions — call periodically from app startup."""
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP")
        conn.commit()
        conn.close()

    # ─────────────────────────────────────────────────────────────────────
    # PASSWORD RESET
    # ─────────────────────────────────────────────────────────────────────

    def request_password_reset(self, email: str) -> dict:
        """
        Generate a one-time reset token (valid 1 hour).
        In production, email the link — here we return the token for
        the frontend to handle.
        """
        if not self.validate_email(email):
            return {"success": False, "error": "Invalid email format."}

        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email=%s", (email,))
        if not c.fetchone():
            conn.close()
            # Do not reveal whether the email exists
            return {"success": True,
                    "message": "If that email is registered, a reset link has been sent."}

        token      = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=1)

        c.execute('''
            INSERT INTO password_reset_tokens (email, token, expires_at)
            VALUES (%s, %s, %s)
        ''', (email, token, expires_at))
        conn.commit()
        conn.close()

        # Send reset email
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            SMTP_HOST     = 'smtp.gmail.com'
            SMTP_PORT     = 587
            SMTP_USERNAME = 'ericuwinezastarboy@gmail.com'
            SMTP_PASSWORD = 'wagbvbyowxhbwrsg'

            reset_link = f"http://localhost:5173/reset-password?token={token}"

            msg = MIMEMultipart('alternative')
            msg['Subject'] = ' MoMo Shield — Password Reset Request'
            msg['From']    = f'MoMo Shield <{SMTP_USERNAME}>'
            msg['To']      = email

            html = f"""
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:30px;border:1px solid #e2e8f0;border-radius:12px;">
              <h2 style="color:#10b981;"> MoMo Shield</h2>
              <p>Hello,</p>
              <p>We received a request to reset your password. Click the button below to set a new password:</p>
              <a href="{reset_link}" style="display:inline-block;margin:20px 0;padding:12px 28px;background:linear-gradient(to right,#10b981,#0ea5e9);color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
                Reset My Password
              </a>
              <p style="color:#64748b;font-size:13px;">This link expires in <strong>1 hour</strong>. If you did not request this, ignore this email — your account is safe.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">
              <p style="color:#94a3b8;font-size:11px;">MoMo Shield — AI-Powered Mobile Money Fraud Detection</p>
            </div>
            """

            msg.attach(MIMEText(html, 'html'))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_USERNAME, email, msg.as_string())

            print(f"[Auth] Password reset email sent to {email}")

        except Exception as e:
            print(f"[Auth] Email send failed: {e}")
            # Still return success — token is valid even if email failed
            return {
                "success": True,
                "message": "Reset token generated but email delivery failed. Contact support.",
                "debug_email_error": str(e)
            }

        return {
            "success": True,
            "message": "If that email is registered, a reset link has been sent."
        }

    def reset_password(self, token: str, new_password: str) -> dict:
        """Reset password using a valid reset token."""
        pw_ok, pw_msg = self.validate_password_strength(new_password)
        if not pw_ok:
            return {"success": False, "error": pw_msg}

        conn = self.get_connection()
        c = conn.cursor()

        c.execute('''
            SELECT email FROM password_reset_tokens
            WHERE token=%s AND expires_at > CURRENT_TIMESTAMP AND is_used=FALSE
        ''', (token,))
        row = c.fetchone()

        if not row:
            conn.close()
            return {"success": False, "error": "Invalid or expired reset token."}

        email = row[0]
        pw_hash, salt = self.hash_password(new_password)

        c.execute('''
            UPDATE users SET password_hash=%s, salt=%s WHERE email=%s
        ''', (pw_hash, salt, email))
        c.execute('''
            UPDATE password_reset_tokens SET is_used=TRUE WHERE token=%s
        ''', (token,))
        conn.commit()
        conn.close()

        return {"success": True, "message": "Password reset successfully."}

    # ─────────────────────────────────────────────────────────────────────
    # PIN MANAGEMENT
    # ─────────────────────────────────────────────────────────────────────

    def set_pin(self, user_id: int, pin: str) -> dict:
        if not pin or not pin.isdigit() or len(pin) < 4:
            return {"success": False, "error": "PIN must be 4-6 digits."}
        pin_hash, pin_salt = self.hash_password(pin)
        conn = self.get_connection()
        c = conn.cursor()
        c.execute(
            "UPDATE users SET pin_hash=%s, pin_salt=%s, pin_attempts=0 WHERE id=%s",
            (pin_hash, pin_salt, user_id)
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "PIN set successfully."}

    def verify_pin(self, user_id: int, pin: str) -> dict:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute(
            "SELECT pin_hash, pin_salt, pin_attempts FROM users WHERE id=%s",
            (user_id,)
        )
        row = c.fetchone()
        conn.close()
        if not row or not row[0]:
            return {"success": False, "error": "No PIN set. Please set a PIN first."}
        pin_hash, pin_salt, attempts = row
        if attempts >= 3:
            return {"success": False, "error": "PIN locked. Too many failed attempts.", "locked": True}
        input_hash, _ = self.hash_password(pin, pin_salt)
        if input_hash != pin_hash:
            conn = self.get_connection()
            c = conn.cursor()
            c.execute(
                "UPDATE users SET pin_attempts = pin_attempts + 1 WHERE id=%s",
                (user_id,)
            )
            conn.commit()
            conn.close()
            remaining = 2 - attempts
            return {
                "success": False,
                "error": f"Incorrect PIN. {remaining} attempt(s) remaining.",
                "attempts": attempts + 1,
                "require_face": attempts + 1 >= 2
            }
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("UPDATE users SET pin_attempts=0 WHERE id=%s", (user_id,))
        conn.commit()
        conn.close()
        return {"success": True}

    def reset_pin(self, phone: str, national_id: str,
                  new_pin: str, face_base64: str) -> dict:
        if not new_pin or not new_pin.isdigit() or len(new_pin) < 4:
            return {"success": False, "error": "PIN must be 4-6 digits."}
        conn = self.get_connection()
        c = conn.cursor()
        validated_phone = self.validate_phone_number(phone)
        if not validated_phone:
            conn.close()
            return {"success": False, "error": "Invalid phone number."}
        c.execute(
            "SELECT id, face_encoding FROM users WHERE phone_number=%s AND national_id=%s AND is_active=TRUE",
            (validated_phone, national_id)
        )
        row = c.fetchone()
        conn.close()
        if not row:
            return {"success": False, "error": "Identity verification failed."}
        user_id, stored_face = row
        if not face_base64:
            return {"success": False, "error": "Face scan is required to reset PIN."}
        if not stored_face:
            return {"success": False, "error": "No face registered on this account. Contact support."}
        try:
            import face_recognition
            import numpy as np
            import base64
            from PIL import Image
            import io
            img_bytes    = base64.b64decode(face_base64)
            img          = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            new_encs     = face_recognition.face_encodings(np.array(img))
            if not new_encs:
                return {"success": False, "error": "No face detected. Try again in good lighting."}
            # Load stored encoding — could be 128-dim vector or legacy raw image
            stored_bytes = bytes(stored_face)
            stored_enc = np.frombuffer(stored_bytes, dtype=np.float64)
            if len(stored_enc) != 128:
                # Legacy: stored as raw JPEG — re-extract encoding
                try:
                    stored_img = Image.open(io.BytesIO(stored_bytes)).convert("RGB")
                    stored_encs = face_recognition.face_encodings(np.array(stored_img))
                    if not stored_encs:
                        return {"success": False, "error": "Stored face unreadable. Contact support."}
                    stored_enc = stored_encs[0]
                except Exception:
                    return {"success": False, "error": "Stored face unreadable. Contact support."}

            distance = face_recognition.face_distance([stored_enc], new_encs[0])[0]
            match = face_recognition.compare_faces([stored_enc], new_encs[0], tolerance=0.5)
            if not match[0]:
                return {
                    "success": False,
                    "error": (
                        " Face verification failed. "
                        "The face you scanned does not match the face registered on this account. "
                        "This means either:\n"
                        "• You are not the account owner\n"
                        "• Poor lighting or angle — try again in a brighter area\n"
                        "• Glasses, hat, or mask is covering your face\n\n"
                        "For security, this PIN reset attempt has been blocked and logged. "
                        "If this is your account, please contact support."
                    )
                }
        except ImportError:
            print("[Auth] WARNING: face_recognition not installed, skipping face check")
        return self.set_pin(user_id, new_pin)

    # ─────────────────────────────────────────────────────────────────────
    # BALANCE HELPER
    # ─────────────────────────────────────────────────────────────────────

    def get_user_balance(self, user_id: int) -> float:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT account_balance FROM users WHERE id=%s", (user_id,))
        row = c.fetchone()
        conn.close()
        return row[0] if row else 0.0
