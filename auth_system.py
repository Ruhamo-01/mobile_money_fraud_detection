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

import sqlite3
import hashlib
import secrets
import re
from datetime import datetime, timedelta


class AuthenticationSystem:
    def __init__(self, db_path="mobile_money_users.db"):
        self.db_path = db_path
        self.init_database()

    # ─────────────────────────────────────────────────────────────────────
    # DATABASE INIT
    # ─────────────────────────────────────────────────────────────────────

    def init_database(self):
        """Create auth-related tables if they do not exist."""
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        # Password reset tokens
        c.execute('''
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                email      TEXT    NOT NULL,
                token      TEXT    UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                is_used    BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Session tokens
        c.execute('''
            CREATE TABLE IF NOT EXISTS user_sessions (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id       INTEGER NOT NULL,
                session_token TEXT    UNIQUE NOT NULL,
                expires_at    TIMESTAMP NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Main users table (created here if fraud_detection hasn't run yet)
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                phone_number        TEXT    UNIQUE NOT NULL,
                full_name           TEXT    NOT NULL,
                national_id         TEXT    UNIQUE NOT NULL,
                email               TEXT    UNIQUE NOT NULL,
                password_hash       TEXT    DEFAULT '',
                salt                TEXT    DEFAULT '',
                gender              TEXT    DEFAULT '',
                registration_date   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active           BOOLEAN DEFAULT 1,
                face_encoding       BLOB,
                face_image_path     TEXT,
                verification_status TEXT    DEFAULT 'pending',
                account_balance     REAL    DEFAULT 0.0,
                last_login          TIMESTAMP
            )
        ''')

        # Safe migrations — add columns that may be missing in older DBs
        for col_sql in [
            "ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''",
            "ALTER TABLE users ADD COLUMN face_encoding BLOB",
            "ALTER TABLE users ADD COLUMN face_image_path TEXT",
            "ALTER TABLE users ADD COLUMN verification_status TEXT DEFAULT 'pending'",
        ]:
            try:
                c.execute(col_sql)
            except Exception:
                pass  # column already exists

        conn.commit()
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
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            "SELECT id FROM users WHERE phone_number=? OR email=? OR national_id=?",
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
                from fraud_detection import UserRegistrationSystem as URS
                urs = URS(self.db_path)
                face_result = urs.extract_face_encoding_from_base64(face_base64)
                
                if face_result["error"]:
                    return {"success": False, "error": face_result["error"]}
                
                face_encoding = face_result["encoding"]
                face_image_path = face_result["image_path"]
                print(f"[Auth] Face saved to: {face_image_path}, size: {face_result.get('face_size', 'unknown')}")
                
            except Exception as e:
                print(f"[Auth] Face encoding error: {e}")
                return {"success": False, "error": f"Face processing failed: {str(e)}"}

        verification_status = "verified" if face_encoding else "pending"

        # ── Insert user ──────────────────────────────────────────────────
        try:
            c.execute('''
                INSERT INTO users
                (phone_number, full_name, national_id, email,
                 password_hash, salt, gender,
                 face_encoding, verification_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (validated_phone, full_name, national_id, email,
                  pw_hash, salt, gender,
                  face_encoding, verification_status))
            conn.commit()
        except sqlite3.IntegrityError:
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

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        if email:
            c.execute('''
                SELECT id, phone_number, password_hash, salt, full_name, is_active, email
                FROM users WHERE email = ?
            ''', (email,))
        else:
            validated = self.validate_phone_number(phone_number)
            if not validated:
                conn.close()
                return {"success": False, "error": "Invalid phone number."}
            c.execute('''
                SELECT id, phone_number, password_hash, salt, full_name, is_active, email
                FROM users WHERE phone_number = ?
            ''', (validated,))

        user = c.fetchone()

        if not user:
            conn.close()
            return {"success": False, "error": "No account found with these credentials."}

        user_id, user_phone, pw_hash, salt, full_name, is_active, user_email = user

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
            VALUES (?, ?, ?)
        ''', (user_id, token, expires_at))
        c.execute("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?",
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
                "email": user_email
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
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        try:
            c.execute('''
                SELECT u.id, u.phone_number, u.full_name, u.account_balance,
                       u.email, u.national_id, u.gender, u.verification_status,
                       u.face_encoding IS NOT NULL AS has_face
                FROM user_sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.session_token = ?
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
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("DELETE FROM user_sessions WHERE session_token=?", (session_token,))
        conn.commit()
        conn.close()
        return {"success": True, "message": "Logged out successfully."}

    def cleanup_expired_sessions(self):
        """Remove expired sessions — call periodically from app startup."""
        conn = sqlite3.connect(self.db_path)
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

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT id FROM users WHERE email=?", (email,))
        if not c.fetchone():
            conn.close()
            # Do not reveal whether the email exists
            return {"success": True,
                    "message": "If that email is registered, a reset link has been sent."}

        token      = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=1)

        c.execute('''
            INSERT INTO password_reset_tokens (email, token, expires_at)
            VALUES (?, ?, ?)
        ''', (email, token, expires_at))
        conn.commit()
        conn.close()

        # TODO: send email with reset link containing token
        return {
            "success": True,
            "message": "Reset token generated.",
            "token"  : token   # remove in production; send via email instead
        }

    def reset_password(self, token: str, new_password: str) -> dict:
        """Reset password using a valid reset token."""
        pw_ok, pw_msg = self.validate_password_strength(new_password)
        if not pw_ok:
            return {"success": False, "error": pw_msg}

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT email FROM password_reset_tokens
            WHERE token=? AND expires_at > CURRENT_TIMESTAMP AND is_used=0
        ''', (token,))
        row = c.fetchone()

        if not row:
            conn.close()
            return {"success": False, "error": "Invalid or expired reset token."}

        email = row[0]
        pw_hash, salt = self.hash_password(new_password)

        c.execute('''
            UPDATE users SET password_hash=?, salt=? WHERE email=?
        ''', (pw_hash, salt, email))
        c.execute('''
            UPDATE password_reset_tokens SET is_used=1 WHERE token=?
        ''', (token,))
        conn.commit()
        conn.close()

        return {"success": True, "message": "Password reset successfully."}

    # ─────────────────────────────────────────────────────────────────────
    # BALANCE HELPER
    # ─────────────────────────────────────────────────────────────────────

    def get_user_balance(self, user_id: int) -> float:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute("SELECT account_balance FROM users WHERE id=?", (user_id,))
        row = c.fetchone()
        conn.close()
        return row[0] if row else 0.0
