"""
money_transfer.py — Money Transfer System
==========================================
Flow:
  1. Validate session → get sender
  2. Validate recipient phone → detect network (MTN / Tigo)
  3. Validate amount (> 0 only)
  4. Run RealTimeFraudDetector.evaluate_transaction()   ← ML runs FIRST
       - ALLOW          → check balance, deduct, complete transfer
       - REQUIRE_FACE   → return face-verification challenge to frontend
       - BLOCK          → reject immediately (ML caught it — above balance,
                          drain, rapid transfers, etc.)
  5. Balance check ONLY happens after ML says ALLOW
  6. If caller supplies face_base64 on retry → fraud check runs again
     with the image, resolves to ALLOW or BLOCK
"""

import sqlite3
import re
import random
from datetime import datetime
from auth_system import AuthenticationSystem
from fraud_detection import RealTimeFraudDetector


class MoneyTransferSystem:
    def __init__(self, db_path="mobile_money_users.db"):
        self.db_path    = db_path
        self.auth       = AuthenticationSystem(db_path)
        self.fraud_det  = RealTimeFraudDetector(db_path)
        self._init_tables()
        self._init_balance_attempt_table()

    # ─────────────────────────────────────────────────────────────────────
    # DATABASE INIT
    # ─────────────────────────────────────────────────────────────────────

    def _init_tables(self):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            CREATE TABLE IF NOT EXISTS money_transfers (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id        INTEGER NOT NULL,
                recipient_phone  TEXT    NOT NULL,
                amount           REAL    NOT NULL,
                fee              REAL    DEFAULT 0.0,
                transfer_type    TEXT    NOT NULL,
                network          TEXT    NOT NULL,
                reference_number TEXT    UNIQUE,
                status           TEXT    DEFAULT 'pending',
                fraud_score      REAL    DEFAULT 0.0,
                ml_score         REAL    DEFAULT 0.0,
                rule_score       REAL    DEFAULT 0.0,
                risk_level       TEXT    DEFAULT 'LOW',
                is_fraud         BOOLEAN DEFAULT 0,
                face_verified    BOOLEAN DEFAULT 0,
                created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at     TIMESTAMP,
                notes            TEXT,
                FOREIGN KEY (sender_id) REFERENCES users (id)
            )
        ''')

        c.execute('''
            CREATE TABLE IF NOT EXISTS network_fees (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                network        TEXT NOT NULL,
                min_amount     REAL DEFAULT 0,
                max_amount     REAL DEFAULT 999999999,
                fee_type       TEXT DEFAULT 'fixed',
                fee_amount     REAL DEFAULT 0,
                percentage_fee REAL DEFAULT 0
            )
        ''')

        # Seed fees once
        c.execute("DELETE FROM network_fees")
        c.execute("SELECT COUNT(*) FROM network_fees")
        if c.fetchone()[0] == 0:
            c.executemany('''
                INSERT INTO network_fees
                (network, min_amount, max_amount, fee_type, fee_amount, percentage_fee)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', [
                ("MTN",  1,        1000,       "fixed",      20,   0.0),
                ("MTN",  1001,     10000,      "fixed",     100,   0.0),
                ("MTN",  10001,    150000,     "fixed",     250,   0.0),
                ("MTN",  150001,   2000000,    "fixed",    1500,   0.0),
                ("Tigo", 1,        1000,       "fixed",      20,   0.0),
                ("Tigo", 1001,     10000,      "fixed",     100,   0.0),
                ("Tigo", 10001,    150000,     "fixed",     250,   0.0),
                ("Tigo", 150001,   2000000,    "fixed",    1500,   0.0),
            ])

        try:
            c.execute('ALTER TABLE money_transfers ADD COLUMN fee REAL DEFAULT 0.0')
            conn.commit()
        except Exception:
            pass
        conn.commit()
        conn.close()

    # ─────────────────────────────────────────────────────────────────────
    # OVER-BALANCE ATTEMPT TRACKING
    # ─────────────────────────────────────────────────────────────────────

    def _init_balance_attempt_table(self):
        """
        Tracks consecutive over-balance attempts per user.
        Resets when a transaction is eventually allowed or when the user
        makes a successful transfer.
        """
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS over_balance_attempts (
                user_id       INTEGER PRIMARY KEY,
                attempt_count INTEGER DEFAULT 0,
                last_attempt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        conn.commit()
        conn.close()

    def _get_over_balance_count(self, user_id: int) -> int:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        
        # Check if last attempt was from a previous day - if so, reset at midnight
        c.execute(
            "SELECT attempt_count, last_attempt FROM over_balance_attempts WHERE user_id = ?",
            (user_id,)
        )
        row = c.fetchone()
        
        if row:
            attempt_count, last_attempt = row
            # Convert last_attempt to date and compare with today
            from datetime import datetime
            last_date = datetime.strptime(last_attempt, "%Y-%m-%d %H:%M:%S").date()
            today = datetime.now().date()
            
            if last_date < today:
                # Reset counter at midnight for new day
                c.execute(
                    "DELETE FROM over_balance_attempts WHERE user_id = ?",
                    (user_id,)
                )
                conn.commit()
                conn.close()
                return 0
            else:
                conn.close()
                return attempt_count
        else:
            conn.close()
            return 0

    def _increment_over_balance(self, user_id: int):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            INSERT INTO over_balance_attempts (user_id, attempt_count, last_attempt)
            VALUES (?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE
            SET attempt_count = attempt_count + 1,
                last_attempt  = CURRENT_TIMESTAMP
        ''', (user_id,))
        conn.commit()
        conn.close()

    def _reset_over_balance(self, user_id: int):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute(
            "DELETE FROM over_balance_attempts WHERE user_id = ?",
            (user_id,)
        )
        conn.commit()
        conn.close()

    # ─────────────────────────────────────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────────────────────────────────────

    def _validate_recipient(self, phone: str) -> dict:
        phone = phone.strip().replace(" ", "")
        if phone.startswith("+250"):
            core = phone[4:]
        elif phone.startswith("250"):
            core = phone[3:]
        elif phone.startswith("0"):
            core = phone[1:]
        else:
            core = phone

        if re.match(r'^(78|79)\d{7}$', core):
            return {"valid": True,  "phone": f"+250{core}", "network": "MTN"}
        if re.match(r'^(72|73)\d{7}$', core):
            return {"valid": True,  "phone": f"+250{core}", "network": "Tigo"}
        return {"valid": False, "phone": phone, "network": None}

    def _calculate_fee(self, network: str, amount: float) -> float:
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        c.execute('''
            SELECT fee_type, fee_amount, percentage_fee
            FROM network_fees
            WHERE network=? AND min_amount<=? AND max_amount>=?
        ''', (network, amount, amount))
        row = c.fetchone()
        conn.close()
        if not row:
            return 0.0
        fee_type, fee_amount, pct = row
        return fee_amount if fee_type == "fixed" else (amount * pct / 100)

    def _generate_reference(self) -> str:
        return f"TXN{datetime.now().strftime('%Y%m%d')}{random.randint(100000,999999)}"

    def _get_balance(self, user_id: int) -> float:
        return self.auth.get_user_balance(user_id)

    # ─────────────────────────────────────────────────────────────────────
    # MAIN TRANSFER METHOD
    # ─────────────────────────────────────────────────────────────────────

    def initiate_transfer(self, session_token: str,
                          recipient_phone: str,
                          amount: float,
                          transfer_type: str = "mobile_money",
                          face_base64: str = None) -> dict:

        # ── 1. Session validation ────────────────────────────────────────
        user = self.auth.validate_session(session_token)
        if not user:
            return {"success": False,
                    "error": "Session expired. Please log in again."}

        # ── 1b. Travel / SIM block check (sender) ────────────────────────
        try:
            conn = sqlite3.connect(self.db_path)
            c = conn.cursor()
            today = __import__('datetime').date.today().isoformat()
            c.execute('''
                SELECT destination_country, return_date FROM travel_records
                WHERE user_phone = ?
                  AND date(departure_date) <= date(?)
                  AND date(return_date)    >= date(?)
                ORDER BY id DESC LIMIT 1
            ''', (user["phone"], today, today))
            travel_row = c.fetchone()
            conn.close()
            if travel_row:
                return {
                    "success": False,
                    "action": "BLOCK",
                    "error": (
                        f"✈️ Your SIM is blocked while you are abroad in "
                        f"{travel_row[0]}. Transfers are disabled until your "
                        f"return on {travel_row[1]}. "
                        f"Contact your service provider if you are already back."
                    )
                }
        except Exception:
            pass

        # ── 2. Recipient validation ───────────────────────────────────────
        recipient = self._validate_recipient(recipient_phone)
        if not recipient["valid"]:
            return {"success": False,
                    "error": ("Invalid recipient phone number. "
                              "Use 078, 079 (MTN) or 072, 073 (Tigo) format.")}

        # ── 2b. Recipient travel block check ─────────────────────────────
        try:
            import datetime as _dt
            _today = _dt.date.today().isoformat()
            _conn = sqlite3.connect(self.db_path)
            _c = _conn.cursor()
            _c.execute("""
                SELECT destination_country, return_date FROM travel_records
                WHERE user_phone = ?
                  AND date(departure_date) <= date(?)
                  AND date(return_date)    >= date(?)
                ORDER BY id DESC LIMIT 1
            """, (recipient["phone"], _today, _today))
            _rec_travel = _c.fetchone()
            _conn.close()
            if _rec_travel:
                return {
                    "success": False,
                    "action": "BLOCK",
                    "error": (
                        f"✈️ This recipient is currently abroad in {_rec_travel[0]} "
                        f"and cannot receive transfers until {_rec_travel[1]}. "
                        f"Their SIM is blocked for travel security."
                    )
                }
        except Exception:
            pass

        # ── 3. Basic input validation (not a rule — just math) ─────────────
        if not isinstance(amount, (int, float)) or amount <= 0:
            return {"success": False, "error": "Amount must be greater than 0."}

        fee   = self._calculate_fee(recipient["network"], amount)
        total = amount + fee

        # ── 3b. Over-balance attempt gating ──────────────────────────────
        # Rules (applied BEFORE ML to avoid unnecessary model call):
        #   1st attempt with amount > balance  → show "insufficient balance", done.
        #   2nd attempt:
        #     - amount still > balance          → hard block, no face needed.
        #     - amount now within balance       → mark user untrusted, pass to ML
        #                                         which will REQUIRE_FACE.
        #   Successful transfer resets counter.
        balance_now = self._get_balance(user["id"])
        over_balance_count = self._get_over_balance_count(user["id"])

        if amount > balance_now:
            if over_balance_count == 0:
                # First offence — soft message only, track it, return early.
                self._increment_over_balance(user["id"])
                return {
                    "success": False,
                    "error": (
                        f"Insufficient balance. "
                        f"You need {total:,.0f} RWF "
                        f"(amount {amount:,.0f} + fee {fee:,.0f}), "
                        f"but your balance is {balance_now:,.0f} RWF."
                    )
                }
            else:
                # Second (or more) offence and amount STILL over balance → hard block.
                self._increment_over_balance(user["id"])
                return {
                    "success": False,
                    "action": "BLOCK",
                    "error": (
                        "Transaction blocked. You have previously attempted a transfer "
                        "that exceeded your balance. Please top up your account and "
                        "contact support if you believe this is an error."
                    )
                }
        else:
            # Amount is within balance. Did the user PREVIOUSLY go over-balance?
            if over_balance_count > 0:
                # Previous attempt was over balance; amount now OK but user is untrusted.
                # Let ML handle it — pass `untrusted=True` so it forces REQUIRE_FACE
                # regardless of ML score.
                untrusted_flag = True
            else:
                untrusted_flag = False

        # ── 4. ML model — sole decision maker ────────────────────────────
        # No hard rules. The model decides everything: velocity bursts,
        # amount spikes, drain patterns — all learned from data.
        # Over-balance hard rules are handled above; untrusted flag forces face.
        fraud_result = self.fraud_det.evaluate_transaction(
            phone_number    = user["phone"],
            amount          = amount,
            recipient_phone = recipient["phone"],
            network         = recipient["network"],
            face_base64     = face_base64,
            untrusted       = untrusted_flag,
        )

        action        = fraud_result["action"]       # ALLOW | REQUIRE_FACE | BLOCK
        risk_level    = fraud_result["risk_level"]
        fraud_score   = fraud_result["fraud_score"]
        ml_score      = fraud_result["ml_score"]
        rule_score    = fraud_result["rule_score"]
        face_verified = fraud_result.get("face_verified")

        # ── 4a. Face verification required ───────────────────────────────
        if action == "REQUIRE_FACE":
            return {
                "success"      : False,
                "face_required": True,
                "action"       : "REQUIRE_FACE",
                "risk_level"   : risk_level,
                "fraud_score"  : fraud_score,
                "message"      : fraud_result["message"],
                "alert"        : fraud_result.get("alert"),
            }

        # ── 4b. Blocked by ML model ───────────────────────────────────────
        if action == "BLOCK":
            self._record_transfer(
                sender_id       = user["id"],
                recipient_phone = recipient["phone"],
                amount          = amount,
                transfer_type   = transfer_type,
                network         = recipient["network"],
                reference       = self._generate_reference(),
                status          = "blocked",
                fraud_score     = fraud_score,
                ml_score        = ml_score,
                rule_score      = rule_score,
                risk_level      = risk_level,
                is_fraud        = True,
                face_verified   = bool(face_verified) if face_verified is not None else False,
                fee             = fee,
                notes           = fraud_result["message"],
            )
            return {
                "success"    : False,
                "action"     : "BLOCK",
                "risk_level" : risk_level,
                "fraud_score": fraud_score,
                "error"      : fraud_result["message"],
                "alert"      : fraud_result.get("alert"),
            }

        # ── 5. Final balance check (safety net — ML should have caught issues above) ──
        balance = self._get_balance(user["id"])
        if balance < total:
            # Shouldn't reach here for 1x (handled before ML) or 2x+ (ML blocks)
            # This covers edge cases where ML allowed but balance is still short
            return {
                "success": False,
                "error": (
                    f"Insufficient balance. "
                    f"Required: {total:,.0f} RWF "
                    f"(amount {amount:,.0f} + fee {fee:,.0f}), "
                    f"available: {balance:,.0f} RWF."
                )
            }



        # ── 6. Complete the transfer ──────────────────────────────────────
        reference = self._generate_reference()

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            UPDATE users SET account_balance = account_balance - ?
            WHERE id = ?
        ''', (total, user["id"]))

        c.execute('''
            UPDATE users SET account_balance = account_balance + ?
            WHERE phone_number = ? AND is_active = 1
        ''', (amount, recipient["phone"]))

        conn.commit()
        conn.close()

        # Reset over-balance counter — legitimate transfer completed.
        self._reset_over_balance(user["id"])

        self._record_transfer(
            sender_id       = user["id"],
            recipient_phone = recipient["phone"],
            amount          = amount,
            transfer_type   = transfer_type,
            network         = recipient["network"],
            reference       = reference,
            status          = "completed",
            fraud_score     = fraud_score,
            ml_score        = ml_score,
            rule_score      = rule_score,
            risk_level      = risk_level,
            is_fraud        = False,
            face_verified   = bool(face_verified) if face_verified is not None else False,
            fee             = fee,
            notes           = fraud_result["message"],
        )

        return {
            "success"      : True,
            "action"       : "ALLOW",
            "message"      : "Transfer completed successfully.",
            "reference"    : reference,
            "recipient"    : recipient["phone"],
            "network"      : recipient["network"],
            "amount"       : amount,
            "fee"          : fee,
            "total"        : total,
            "fraud_score"  : fraud_score,
            "risk_level"   : risk_level,
            "face_verified": face_verified,
        }

    # ─────────────────────────────────────────────────────────────────────
    # RECORD HELPER
    # ─────────────────────────────────────────────────────────────────────

    def _record_transfer(self, sender_id, recipient_phone, amount,
                         transfer_type, network, reference, status,
                         fraud_score, ml_score, rule_score, risk_level,
                         is_fraud, face_verified, fee=0.0, notes=""):
        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()
        completed_at = datetime.now() if status == "completed" else None
        c.execute('''
            INSERT INTO money_transfers
            (sender_id, recipient_phone, amount, fee, transfer_type, network,
             reference_number, status, fraud_score, ml_score, rule_score,
             risk_level, is_fraud, face_verified, completed_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (sender_id, recipient_phone, amount, fee, transfer_type, network,
              reference, status, fraud_score, ml_score, rule_score,
              risk_level, is_fraud, face_verified, completed_at, notes))
        conn.commit()
        conn.close()

    # ─────────────────────────────────────────────────────────────────────
    # TRANSFER HISTORY
    # ─────────────────────────────────────────────────────────────────────

    def get_transfer_history(self, session_token: str, limit: int = 50) -> dict:
        user = self.auth.validate_session(session_token)
        if not user:
            return {"success": False, "error": "Invalid session."}

        conn = sqlite3.connect(self.db_path)
        c = conn.cursor()

        c.execute('''
            SELECT mt.reference_number, mt.recipient_phone, mt.amount,
                   COALESCE(mt.fee, 0), mt.network, mt.status, mt.fraud_score,
                   mt.risk_level, mt.is_fraud, mt.face_verified, mt.created_at,
                   mt.notes, u.phone_number, 'sent'
            FROM money_transfers mt
            JOIN users u ON mt.sender_id = u.id
            WHERE mt.sender_id = ?
            ORDER BY mt.created_at DESC LIMIT ?
        ''', (user["id"], limit))
        sent_rows = c.fetchall()

        c.execute('''
            SELECT mt.reference_number, mt.recipient_phone, mt.amount,
                   0, mt.network, mt.status, mt.fraud_score,
                   mt.risk_level, mt.is_fraud, mt.face_verified, mt.created_at,
                   mt.notes, u.phone_number, 'received'
            FROM money_transfers mt
            JOIN users u ON mt.sender_id = u.id
            WHERE mt.recipient_phone = ? AND mt.status = 'completed'
            ORDER BY mt.created_at DESC LIMIT ?
        ''', (user["phone"], limit))
        received_rows = c.fetchall()

        conn.close()

        all_rows = list(sent_rows) + list(received_rows)
        all_rows.sort(key=lambda x: x[10] or "", reverse=True)
        all_rows = all_rows[:limit]

        transfers = []
        for r in all_rows:
            transfers.append({
                "reference"    : r[0],
                "recipient"    : r[1],
                "amount"       : r[2],
                "fee"          : r[3],
                "network"      : r[4],
                "status"       : r[5],
                "fraud_score"  : r[6],
                "risk_level"   : r[7],
                "is_fraud"     : bool(r[8]),
                "face_verified": bool(r[9]),
                "created_at"   : r[10],
                "notes"        : r[11],
                "sender_phone" : r[12],
                "direction"    : r[13],
            })

        return {"success": True, "transfers": transfers}

    # ─────────────────────────────────────────────────────────────────────
    # NETWORK INFO
    # ─────────────────────────────────────────────────────────────────────

    def get_network_info(self, phone: str) -> dict:
        return self._validate_recipient(phone)

    def get_transfer_fee(self, phone: str, amount: float) -> dict:
        recipient = self._validate_recipient(phone)
        if not recipient["valid"]:
            return {"success": False, "error": "Invalid phone number."}
        fee   = self._calculate_fee(recipient["network"], amount)
        total = amount + fee
        return {
            "success": True,
            "network": recipient["network"],
            "amount" : amount,
            "fee"    : fee,
            "total"  : total,
        }
