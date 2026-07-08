"""
fraud_detection.py -- Mobile Money Fraud Detection System
=========================================================
Classes:
  - UserRegistrationSystem   : register users with face encoding
  - TravelMonitoringSystem   : detect abroad users, block SIM transfers
  - TransactionAnomalyDetector: rule-based anomaly scoring from history
  - PinMonitoringSystem      : detect brute-force PIN attempts
  - RealTimeFraudDetector    : ML-powered fraud scoring + face verification gate
  - FraudAlertSystem         : notify service provider when fraud suspected
"""

import psycopg2
import psycopg2.extras
import numpy as np
import pandas as pd
import joblib
import json
import base64
import os
from datetime import datetime, timedelta


# 
# 1. USER REGISTRATION SYSTEM  (phone ↔ name ↔ face mapping)
# 
class UserRegistrationSystem:
    def __init__(self, db_config):
        self.db_config = db_config
        self.init_database()
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def init_database(self):
        """Create all required tables if they do not exist."""
        conn = self.get_connection()
        c = conn.cursor()

        # Main users table -- phone ↔ name ↔ face mapping
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

        # Travel monitoring
        c.execute('''
            CREATE TABLE IF NOT EXISTS travel_records (
                id                  SERIAL PRIMARY KEY,
                user_phone          TEXT,
                departure_date      TIMESTAMP,
                return_date         TIMESTAMP,
                destination_country TEXT,
                sim_deactivated     BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_phone) REFERENCES users (phone_number)
            )
        ''')

        # Transaction history for pattern analysis
        c.execute('''
            CREATE TABLE IF NOT EXISTS transaction_history (
                id               SERIAL PRIMARY KEY,
                user_phone       TEXT,
                amount           REAL,
                transaction_type TEXT,
                timestamp        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                recipient_phone  TEXT,
                is_fraud         BOOLEAN DEFAULT FALSE,
                fraud_score      REAL,
                FOREIGN KEY (user_phone) REFERENCES users (phone_number)
            )
        ''')

        # PIN attempt monitoring
        c.execute('''
            CREATE TABLE IF NOT EXISTS pin_attempts (
                id             SERIAL PRIMARY KEY,
                user_phone     TEXT,
                attempt_time   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                was_successful BOOLEAN DEFAULT FALSE,
                ip_address     TEXT,
                device_id      TEXT,
                FOREIGN KEY (user_phone) REFERENCES users (phone_number)
            )
        ''')

        # Pending deposits table
        c.execute('''
            CREATE TABLE IF NOT EXISTS pending_deposits (
                id         SERIAL PRIMARY KEY,
                user_id    INTEGER,
                amount     REAL,
                reference  TEXT,
                status     TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Safe migration: add gender column if missing
        try:
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT ''")
        except Exception:
            pass

        # Safe migration: add travel_status column if missing
        # 'active' = normal, 'abroad' = registered as travelling (replaces is_active=FALSE)
        try:
            c.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS travel_status TEXT DEFAULT 'active'")
        except Exception:
            pass

        # Migrate existing abroad users: anyone with is_active=FALSE and an active travel record
        # should have travel_status='abroad' and is_active restored to TRUE
        try:
            c.execute("""
                UPDATE users SET travel_status = 'abroad', is_active = TRUE
                WHERE is_active = FALSE
                  AND phone_number IN (
                      SELECT user_phone FROM travel_records
                      WHERE sim_deactivated = TRUE
                        AND date(return_date) >= CURRENT_DATE
                  )
                  AND (travel_status IS NULL OR travel_status = 'active')
            """)
        except Exception:
            pass

        conn.commit()
        c.close()
        conn.close()

    #  Face encoding helpers 

    #  Landmark completeness check 

    def _check_face_completeness(self, face_landmarks: dict) -> dict:
        """
        Verify that the face has all required visible features:
        eyes (left + right), eyebrows, nose, mouth/lips, and chin.
        Returns {"complete": bool, "missing": list, "error": str|None}
        """
        required_features = {
            "left_eye"      : "left eye",
            "right_eye"     : "right eye",
            "left_eyebrow"  : "left eyebrow",
            "right_eyebrow" : "right eyebrow",
            "nose_bridge"   : "nose bridge",
            "nose_tip"      : "nose tip",
            "top_lip"       : "mouth / upper lip",
            "bottom_lip"    : "mouth / lower lip",
            "chin"          : "chin",
        }
        missing = []
        for key, label in required_features.items():
            pts = face_landmarks.get(key, [])
            if not pts or len(pts) < 2:
                missing.append(label)

        if missing:
            parts_str = ", ".join(missing)
            return {
                "complete": False,
                "missing" : missing,
                "error"   : (
                    f"Incomplete face detected -- these features are not visible: {parts_str}. "
                    "Please ensure your full face (eyes, nose, mouth) is clearly visible, "
                    "well-lit, and facing the camera directly."
                )
            }
        return {"complete": True, "missing": [], "error": None}

    def _get_face_encoding(self, base64_str: str) -> dict:
        """
        Single authoritative method to extract a 128-dim face encoding from a
        base64 image. Used by ALL face verification paths.
        Returns: { encoding: np.ndarray|None, error: str|None, face_count: int }
        """
        try:
            import face_recognition
            import io
            from PIL import Image

            img_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            # Upscale small images for reliable detection
            w, h = img.size
            if w < 320 or h < 240:
                scale = max(320 / w, 240 / h)
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
            img_array = np.array(img)

            # Brightness check
            avg = img_array.mean()
            if avg < 25:
                return {"encoding": None, "error": "Image is too dark. Please improve lighting.", "face_count": 0}
            if avg > 248:
                return {"encoding": None, "error": "Image is overexposed. Reduce lighting.", "face_count": 0}

            # Detect face with upsampling
            locs = face_recognition.face_locations(img_array, model="hog", number_of_times_to_upsample=2)
            if not locs:
                # Fallback: 2x upscale
                img_up = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
                locs_up = face_recognition.face_locations(np.array(img_up), model="hog", number_of_times_to_upsample=1)
                if locs_up:
                    locs = [(t//2, r//2, b//2, l//2) for t, r, b, l in locs_up]
                else:
                    return {"encoding": None, "error": "No face detected. Ensure your face is centred, well-lit, and not obscured.", "face_count": 0}

            if len(locs) > 1:
                return {"encoding": None, "error": "Multiple faces detected. Only your face should be in the frame.", "face_count": len(locs)}

            encs = face_recognition.face_encodings(img_array, locs)
            if not encs:
                return {"encoding": None, "error": "Could not generate face encoding. Try again with better lighting.", "face_count": 1}

            return {"encoding": encs[0], "error": None, "face_count": 1}

        except ImportError:
            return {"encoding": None, "error": "Face recognition library is not available. Contact support.", "face_count": 0}
        except Exception as e:
            return {"encoding": None, "error": f"Image processing error: {e}", "face_count": 0}

    def _decode_stored_encoding(self, stored_bytes_raw) -> np.ndarray | None:
        """
        Robustly decode a stored face encoding from the DB.
        Handles: float64 (1024 bytes), float32 (512 bytes), legacy JPEG bytes.
        Returns a 128-dim np.ndarray or None on failure.
        """
        try:
            import face_recognition
            import io
            from PIL import Image

            stored_bytes = bytes(stored_bytes_raw)
            if len(stored_bytes) == 1024:
                enc = np.frombuffer(stored_bytes, dtype=np.float64)
                if len(enc) == 128:
                    return enc
            if len(stored_bytes) == 512:
                enc = np.frombuffer(stored_bytes, dtype=np.float32).astype(np.float64)
                if len(enc) == 128:
                    return enc
            # Legacy: raw JPEG -- re-extract
            stored_img = Image.open(io.BytesIO(stored_bytes)).convert("RGB")
            stored_encs = face_recognition.face_encodings(np.array(stored_img))
            if stored_encs:
                return stored_encs[0]
            return None
        except Exception:
            return None

    def validate_face_quality_only(self, base64_str: str) -> dict:
        """
        Validate face quality and return a real 128-dim encoding.
        Uses face_recognition (same library as all other verification paths).
        Returns { encoding: bytes|None, error: str|None, face_count, face_size }
        """
        result = self._get_face_encoding(base64_str)
        if result["error"]:
            return {"encoding": None, "error": result["error"],
                    "face_count": result["face_count"], "face_size": None}
        return {
            "encoding"  : result["encoding"].tobytes(),
            "error"     : None,
            "face_count": 1,
            "face_size" : "detected",
        }

    def extract_face_encoding_from_base64(self, base64_str: str):
        """
        Extract a face encoding from a base64-encoded image string.
        Requirements enforced:
          1. Exactly one face detected.
          2. Face large enough (≥60x60 px) -- quality check.
          3. All facial landmarks visible: eyes, eyebrows, nose, mouth, chin.
          4. Image saved to uploads/ folder AND encoding stored in DB.
        Returns dict with encoding data, image save path, and validation info.
        """
        try:
            import face_recognition
            import io
            from PIL import Image
            import os
            import uuid
            from datetime import datetime

            img_bytes = base64.b64decode(base64_str)
            img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            # Upscale small images so HOG model can detect faces reliably
            w, h = img.size
            if w < 320 or h < 240:
                scale = max(320 / w, 240 / h)
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

            img_array = np.array(img)

            #  1. Brightness / quality check 
            avg_brightness = img_array.mean()
            if avg_brightness < 25:
                return {
                    "encoding": None, "image_path": None,
                    "error": "Image is too dark. Please improve lighting and try again.",
                    "face_count": 0
                }
            if avg_brightness > 248:
                return {
                    "encoding": None, "image_path": None,
                    "error": "Image is overexposed (too bright). Reduce lighting or move away from direct light.",
                    "face_count": 0
                }

            #  2. Detect face locations with upsampling 
            face_locations = face_recognition.face_locations(img_array, model="hog", number_of_times_to_upsample=2)
            if not face_locations:
                # Fallback: try with 2x upscaled image
                img_up = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
                img_array_up = np.array(img_up)
                face_locations_up = face_recognition.face_locations(img_array_up, model="hog", number_of_times_to_upsample=1)
                if face_locations_up:
                    face_locations = [(t//2, r//2, b//2, l//2) for t, r, b, l in face_locations_up]
                else:
                    return {
                        "encoding": None, "image_path": None,
                        "error": (
                            "No face detected. Please ensure your face is centered, "
                            "well-lit, and not obscured by glasses, mask, or hair."
                        ),
                        "face_count": 0
                    }
            if len(face_locations) > 1:
                return {
                    "encoding": None, "image_path": None,
                    "error": "Multiple faces detected. Only your face should be in the frame.",
                    "face_count": len(face_locations)
                }

            #  3. Face size / quality gate 
            top, right, bottom, left = face_locations[0]
            face_width  = right - left
            face_height = bottom - top
            min_face_px = 60
            if face_width < min_face_px or face_height < min_face_px:
                return {
                    "encoding": None, "image_path": None,
                    "error": (
                        f"Face is too small ({face_width}x{face_height} px). "
                        "Move closer to the camera so your face fills more of the frame."
                    ),
                    "face_count": 1
                }

            #  4a. Face must cover enough of the image (not too far away) 
            img_h, img_w = img_array.shape[:2]
            face_area_ratio = (face_width * face_height) / (img_w * img_h)
            if face_area_ratio < 0.04:
                return {
                    "encoding": None, "image_path": None,
                    "error": (
                        "Your face is too far from the camera. "
                        "Move closer so your face fills most of the frame."
                    ),
                    "face_count": 1
                }

            #  4b. Face must not be clipped at image edge 
            margin = 5  # pixels
            if top < margin or left < margin or right > img_w - margin or bottom > img_h - margin:
                return {
                    "encoding": None, "image_path": None,
                    "error": (
                        "Your face is too close to the edge or partially cut off. "
                        "Centre your face in the frame and try again."
                    ),
                    "face_count": 1
                }

            #  4c. Landmark completeness -- eyes, nose, mouth must be visible 
            all_landmarks = face_recognition.face_landmarks(img_array, face_locations)
            if not all_landmarks:
                return {
                    "encoding": None, "image_path": None,
                    "error": (
                        "Could not detect facial landmarks. "
                        "Ensure your full face is visible and facing the camera directly."
                    ),
                    "face_count": 1
                }

            landmark_check = self._check_face_completeness(all_landmarks[0])
            if not landmark_check["complete"]:
                return {
                    "encoding": None, "image_path": None,
                    "error": landmark_check["error"],
                    "face_count": 1
                }

            #  4d. Eyes must be open -- check eye height 
            lm = all_landmarks[0]
            def _eye_openness(eye_pts):
                if not eye_pts or len(eye_pts) < 4:
                    return 1.0
                xs = [p[0] for p in eye_pts]
                ys = [p[1] for p in eye_pts]
                width  = max(xs) - min(xs)
                height = max(ys) - min(ys)
                return height / width if width > 0 else 1.0

            left_open  = _eye_openness(lm.get("left_eye",  []))
            right_open = _eye_openness(lm.get("right_eye", []))
            if left_open < 0.10 and right_open < 0.10:
                return {
                    "encoding": None, "image_path": None,
                    "error": (
                        "Your eyes appear to be closed or looking away. "
                        "Please look directly at the camera with eyes open."
                    ),
                    "face_count": 1
                }

            #  4e. Face must be roughly upright -- chin below nose 
            nose_pts = lm.get("nose_tip", [])
            chin_pts = lm.get("chin", [])
            if nose_pts and chin_pts:
                nose_y = sum(p[1] for p in nose_pts) / len(nose_pts)
                chin_y = sum(p[1] for p in chin_pts) / len(chin_pts)
                if chin_y < nose_y:
                    return {
                        "encoding": None, "image_path": None,
                        "error": (
                            "Please hold your head upright and face the camera directly. "
                            "Avoid tilting your head back."
                        ),
                        "face_count": 1
                    }

            #  5. Generate encoding 
            encodings = face_recognition.face_encodings(img_array, face_locations)
            if not encodings:
                return {
                    "encoding": None, "image_path": None,
                    "error": "Failed to generate face encoding. Try again with better lighting.",
                    "face_count": 1
                }

            #  6. Save image to uploads/ folder 
            uploads_dir = "uploads"
            os.makedirs(uploads_dir, exist_ok=True)

            timestamp  = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_id  = str(uuid.uuid4())[:8]
            filename   = f"face_{timestamp}_{unique_id}.jpg"
            image_path = os.path.join(uploads_dir, filename)
            img.save(image_path, "JPEG", quality=95)

            print(f"[FaceEncoding] [OK] Face saved -> {image_path} | size={face_width}x{face_height}")

            return {
                "encoding"  : encodings[0].tobytes(),
                "image_path": image_path,
                "error"     : None,
                "face_count": 1,
                "face_size" : f"{face_width}x{face_height}",
                "landmarks" : list(landmark_check["missing"]),
            }

        except ImportError:
            return {
                "encoding"  : base64.b64decode(base64_str[:200]),
                "image_path": None,
                "error"     : "Face recognition library not available. Face verification will be disabled.",
                "face_count": 0
            }
        except Exception as e:
            print(f"[FaceEncoding] Error: {e}")
            return {
                "encoding": None, "image_path": None,
                "error"   : f"Image processing error: {str(e)}",
                "face_count": 0
            }

    def verify_face_from_base64(self, phone_number: str, base64_str: str,
                                tolerance: float = 0.55) -> dict:
        """
        Dual-source face verification:
          1. Compare live face against DB-stored encoding.
          2. ALSO compare live face against the saved image in uploads/ folder.
        Both sources must agree (match) for verification to pass.
        Returns {"verified": bool, "distance_db": float, "distance_file": float, ...}
        """
        try:
            conn = self.get_connection()
            c = conn.cursor()
            c.execute("SELECT face_encoding, face_image_path FROM users WHERE phone_number = %s",
                      (phone_number,))
            row = c.fetchone()
            conn.close()

            if not row or not row[0]:
                return {"verified": False, "error": "No face data registered for this user"}
        except Exception as e:
            print(f"[FaceVerify] Database error: {e}")
            return {"verified": False, "error": "Face verification system unavailable"}

        stored_encoding_bytes = row[0]
        stored_image_path     = row[1]   # may be None for old registrations

        try:
            import face_recognition
            import io
            from PIL import Image

            #  Decode and validate live image 
            img_bytes  = base64.b64decode(base64_str)
            img        = Image.open(io.BytesIO(img_bytes)).convert("RGB")

            # Upscale small images so HOG model can detect faces reliably
            w, h = img.size
            if w < 320 or h < 240:
                scale = max(320 / w, 240 / h)
                img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

            img_array  = np.array(img)

            # Brightness check
            avg_brightness = img_array.mean()
            if avg_brightness < 20 or avg_brightness > 248:
                return {"verified": False,
                        "error": "Image quality too poor (too dark or too bright). Adjust lighting."}

            # Detect face locations with upsampling
            live_locations = face_recognition.face_locations(img_array, model="hog", number_of_times_to_upsample=2)
            if not live_locations:
                # Fallback: try with 2x upscaled image
                img_up = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
                img_array_up = np.array(img_up)
                live_locations_up = face_recognition.face_locations(img_array_up, model="hog", number_of_times_to_upsample=1)
                if live_locations_up:
                    live_locations = [(t//2, r//2, b//2, l//2) for t, r, b, l in live_locations_up]
                else:
                    return {"verified": False, "error": "No face detected in the submitted image. Ensure good lighting and face the camera directly."}
            if len(live_locations) > 1:
                return {"verified": False, "error": "Multiple faces detected. Only your face should be visible."}

            # Landmark completeness check on live face
            live_landmarks = face_recognition.face_landmarks(img_array, live_locations)
            if live_landmarks:
                lm_check = self._check_face_completeness(live_landmarks[0])
                if not lm_check["complete"]:
                    return {"verified": False, "error": lm_check["error"]}

            live_encs = face_recognition.face_encodings(img_array, live_locations)
            if not live_encs:
                return {"verified": False, "error": "Could not generate face encoding from submitted image."}
            live_enc = live_encs[0]

            #  Source 1: Compare against DB encoding 
            # Robustly decode the stored encoding -- handle both 128-dim float64
            # vectors AND legacy raw JPEG bytes stored by the fallback path.
            stored_enc_db = None
            stored_bytes  = bytes(stored_encoding_bytes)

            # Try float64 first (128 values x 8 bytes = 1024 bytes exactly)
            if len(stored_bytes) == 1024:
                stored_enc_db = np.frombuffer(stored_bytes, dtype=np.float64)
            # Try float32 (128 values x 4 bytes = 512 bytes exactly)
            elif len(stored_bytes) == 512:
                stored_enc_db = np.frombuffer(stored_bytes, dtype=np.float32).astype(np.float64)
            else:
                # Legacy: stored as raw JPEG -- re-extract the 128-dim encoding
                try:
                    import io as _io
                    from PIL import Image as _PILImage
                    stored_img   = _PILImage.open(_io.BytesIO(stored_bytes)).convert("RGB")
                    stored_arr   = np.array(stored_img)
                    stored_locs  = face_recognition.face_locations(stored_arr, model="hog", number_of_times_to_upsample=2)
                    if not stored_locs:
                        return {"verified": False, "error": "Stored face image is unreadable. Please update your face in settings."}
                    stored_encs = face_recognition.face_encodings(stored_arr, stored_locs)
                    if not stored_encs:
                        return {"verified": False, "error": "Could not extract encoding from stored face. Please update your face in settings."}
                    stored_enc_db = stored_encs[0]
                except Exception as re_err:
                    return {"verified": False, "error": f"Stored face data is corrupted. Please update your face in settings. ({re_err})"}

            if stored_enc_db is None or len(stored_enc_db) != 128:
                return {"verified": False, "error": "Stored face encoding is invalid. Please update your face in settings."}

            dist_db  = float(face_recognition.face_distance([stored_enc_db], live_enc)[0])
            match_db = dist_db <= tolerance

            #  Source 2: Compare against saved folder image 
            dist_file  = None
            match_file = None

            if stored_image_path and stored_image_path.strip() and os.path.exists(stored_image_path):
                try:
                    saved_img       = Image.open(stored_image_path).convert("RGB")
                    saved_arr       = np.array(saved_img)
                    saved_locations = face_recognition.face_locations(saved_arr, model="hog")
                    if saved_locations:
                        saved_encs = face_recognition.face_encodings(saved_arr, saved_locations)
                        if saved_encs:
                            dist_file  = float(face_recognition.face_distance([saved_encs[0]], live_enc)[0])
                            match_file = dist_file <= tolerance
                except Exception as fe:
                    print(f"[FaceVerify] Folder image comparison error: {fe}")
                    match_file = None
            else:
                # Handle NULL/empty paths for existing users without saved face images
                print(f"[FaceVerify] No saved face image available (user registered before image saving) -- using DB encoding only")

            #  Decision 
            if match_file is not None:
                verified = match_db and match_file
                source   = "db+folder"
            else:
                verified = match_db
                source   = "db_only"

            result = {
                "verified"      : verified,
                "distance_db"   : round(dist_db, 4),
                "distance_file" : round(dist_file, 4) if dist_file is not None else None,
                "match_db"      : match_db,
                "match_file"    : match_file,
                "tolerance"     : tolerance,
                "source"        : source,
            }

            if not verified:
                if match_file is not None and match_db and not match_file:
                    # Matched DB encoding but not the saved file — possible tampering
                    result["error"] = "Face matched database but could not be confirmed against saved image. Please contact support."
                elif not match_db:
                    # Face was successfully scanned and compared but does not match the registered owner
                    result["error"] = "Transaction failed because you are not the owner of this account."

            return result

        except ImportError:
            print("[FaceVerify] face_recognition not installed -- BLOCKING verification, never bypassing")
            return {
                "verified": False,
                "error": (
                    "Face verification library is not available on this server. "
                    "Face check cannot be completed -- action blocked for security. "
                    "Please contact support."
                )
            }
        except Exception as e:
            return {"verified": False, "error": str(e)}

    #  Registration 

    def register_user_with_face(self, phone_number: str, full_name: str,
                                national_id: str, email: str,
                                password_hash: str, salt: str,
                                gender: str = '',
                                face_base64: str = None) -> dict:
        """
        Register a new user. Face encoding is extracted from base64 image
        captured via the device camera during registration.
        """
        face_encoding = None
        if face_base64:
            face_encoding = self.extract_face_encoding_from_base64(face_base64)

        conn = self.get_connection()
        c = conn.cursor()
        try:
            c.execute('''
                INSERT INTO users
                (phone_number, full_name, national_id, email,
                 password_hash, salt, gender,
                 face_encoding, verification_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (phone_number, full_name, national_id, email,
                  password_hash, salt, gender,
                  face_encoding,
                  'verified' if face_encoding else 'pending'))
            conn.commit()
            return {"success": True,
                    "message": "Account created successfully",
                    "face_registered": face_encoding is not None}
        except psycopg2.IntegrityError:
            return {"success": False,
                    "error": "User with this phone, email, or ID already exists"}
        finally:
            conn.close()

    def update_face_encoding(self, phone_number: str, face_base64: str,
                             overwrite: bool = False) -> dict:
        """
        Update stored face encoding for an existing user.
        If overwrite=True (called from /api/update-face):
          - Deletes the old face image from disk
          - Saves the new image with the SAME filename pattern (one file per user)
          - Updates DB encoding + face_image_path
        If overwrite=False (first-time set):
          - Behaves as before (saves new file)
        """
        # First get existing face_image_path so we can delete it
        existing_path = None
        if overwrite:
            conn = self.get_connection()
            c = conn.cursor()
            c.execute(
                "SELECT face_image_path FROM users WHERE phone_number=%s", (phone_number,)
            )
            row = c.fetchone()
            c.close()
            conn.close()
            if row and row[0]:
                existing_path = row[0]

        face_result = self.extract_face_encoding_from_base64(face_base64)

        if face_result.get("error"):
            return {"success": False, "error": face_result["error"]}
        if not face_result.get("encoding"):
            return {"success": False, "error": "No face detected in provided image"}

        # Delete old file from disk
        if existing_path and os.path.exists(existing_path):
            try:
                os.remove(existing_path)
                print(f"[UpdateFace] Deleted old face image: {existing_path}")
            except Exception as e:
                print(f"[UpdateFace] Could not delete old file: {e}")

        new_path = face_result.get("image_path")
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            UPDATE users
            SET face_encoding = %s, face_image_path = %s, verification_status = 'verified'
            WHERE phone_number = %s
        ''', (face_result["encoding"], new_path, phone_number))
        conn.commit()
        conn.close()
        return {
            "success"   : True,
            "message"   : "Face updated successfully.",
            "image_path": new_path,
            "face_size" : face_result.get("face_size"),
        }

    def get_user_info(self, phone_number: str) -> dict | None:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            SELECT phone_number, full_name, national_id, email,
                   registration_date, is_active, verification_status,
                   account_balance, gender,
                   COALESCE(travel_status, 'active') AS travel_status
            FROM users WHERE phone_number = %s
        ''', (phone_number,))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        return {
            "phone_number"       : row[0],
            "full_name"          : row[1],
            "national_id"        : row[2],
            "email"              : row[3],
            "registration_date"  : row[4],
            "is_active"          : bool(row[5]),
            "verification_status": row[6],
            "account_balance"    : row[7],
            "gender"             : row[8],
            "travel_status"      : row[9],   # 'active' | 'abroad'
        }

    def has_face_registered(self, phone_number: str) -> bool:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT face_encoding FROM users WHERE phone_number = %s",
                  (phone_number,))
        row = c.fetchone()
        conn.close()
        return row is not None and row[0] is not None


# 
# 2. TRAVEL MONITORING SYSTEM
#    When a SIM is registered as abroad -> all outgoing transfers are blocked.
#    SIM is re-enabled only when user confirms return.
# 
class TravelMonitoringSystem:
    def __init__(self, user_system: UserRegistrationSystem):
        self.user_system = user_system

    @property
    def db_config(self):
        return self.user_system.db_config
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def register_travel(self, phone_number: str, departure_date: str,
                        return_date: str, destination_country: str) -> dict:
        """
        Service provider registers that this SIM holder is leaving the country.
        Money transfers are immediately blocked.
        FIX: Block duplicate registrations.
        """
        conn = self.get_connection()
        c = conn.cursor()
        try:
            # Block duplicate: reject if already has an active (sim_deactivated=1) record
            c.execute('''
                SELECT id, destination_country, return_date FROM travel_records
                WHERE user_phone = %s AND sim_deactivated = TRUE
                ORDER BY id DESC LIMIT 1
            ''', (phone_number,))
            existing = c.fetchone()
            if existing:
                return {
                    "success": False,
                    "error": (f"This number already has an active travel record "
                              f"to {existing[1]} until {existing[2]}. "
                              f"Please reactivate the SIM before registering a new trip.")
                }
            c.execute('''
                INSERT INTO travel_records
                (user_phone, departure_date, return_date, destination_country, sim_deactivated)
                VALUES (%s, %s, %s, %s, TRUE)
            ''', (phone_number, departure_date, return_date, destination_country))
            # Set travel_status to 'abroad' — do NOT set is_active=FALSE so the
            # account is not treated as deactivated, just flagged as abroad.
            c.execute("UPDATE users SET travel_status = 'abroad' WHERE phone_number = %s",
                      (phone_number,))
            conn.commit()
            return {
                "success": True,
                "message": (f"Travel registered. Transfers for "
                            f"{phone_number} will require face verification until {return_date}. "
                            f"Destination: {destination_country}.")
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            conn.close()

    def reactivate_on_return(self, phone_number: str) -> dict:
        """Re-enable transfers after user confirms return.
        FIX: Find the latest record regardless of date, mark sim_deactivated=0,
        set return_date to yesterday so is_user_abroad() returns False immediately.
        """
        conn = self.get_connection()
        c = conn.cursor()
        try:
            # Get the latest travel record for this phone
            c.execute('''
                SELECT id FROM travel_records
                WHERE user_phone = %s
                ORDER BY id DESC LIMIT 1
            ''', (phone_number,))
            row = c.fetchone()
            if row:
                # Set return_date to yesterday so is_user_abroad() is False immediately
                yesterday = (datetime.now() - __import__('datetime').timedelta(days=1)).strftime('%Y-%m-%d')
                c.execute('''
                    UPDATE travel_records
                    SET sim_deactivated = FALSE, return_date = %s
                    WHERE id = %s
                ''', (yesterday, row[0]))
                c.execute("UPDATE users SET travel_status = 'active' WHERE phone_number = %s",
                          (phone_number,))
                conn.commit()
                return {"success": True,
                        "message": "SIM reactivated. Transfers re-enabled."}
            return {"success": False,
                    "error": "No travel record found for this user."}
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            conn.close()

    def is_user_abroad(self, phone_number: str) -> bool:
        """Return True if the user has travel_status = 'abroad' OR has an active travel record."""
        conn = self.get_connection()
        c = conn.cursor()
        # First check the fast travel_status column
        try:
            c.execute("SELECT travel_status FROM users WHERE phone_number = %s", (phone_number,))
            row = c.fetchone()
            if row and row[0] == 'abroad':
                conn.close()
                return True
        except Exception:
            pass
        # Fallback: check travel_records directly (handles legacy data)
        today = datetime.now().strftime('%Y-%m-%d')
        c.execute('''
            SELECT id FROM travel_records
            WHERE user_phone = %s
              AND date(departure_date) <= date(%s)
              AND date(return_date)    >= date(%s)
              AND sim_deactivated = TRUE
        ''', (phone_number, today, today))
        row = c.fetchone()
        conn.close()
        return row is not None

    def get_travel_status(self, phone_number: str) -> dict:
        """FIX: Return is_abroad key (frontend expects this), query only active records."""
        conn = self.get_connection()
        c = conn.cursor()
        # Only get records where sim is still deactivated (not yet reactivated)
        c.execute('''
            SELECT departure_date, return_date, destination_country, sim_deactivated
            FROM travel_records
            WHERE user_phone = %s AND sim_deactivated = TRUE
            ORDER BY id DESC LIMIT 1
        ''', (phone_number,))
        row = c.fetchone()
        conn.close()
        if not row:
            return {
                "has_travel_record": False,
                "is_abroad": False,
            }
        is_abroad = self.is_user_abroad(phone_number)
        return {
            "has_travel_record"  : True,
            "departure_date"     : row[0],
            "return_date"        : row[1],
            "destination_country": row[2],
            "sim_deactivated"    : bool(row[3]),
            "is_abroad"          : is_abroad,
        }


# 
# 3. TRANSACTION ANOMALY DETECTOR  (rule-based, complements ML model)
# 
class TransactionAnomalyDetector:
    ANOMALY_THRESHOLD = 0.65   # above this -> face verification required

    def __init__(self, user_system: UserRegistrationSystem):
        self.user_system = user_system

    @property
    def db_config(self):
        return self.user_system.db_config
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def record_transaction(self, phone_number: str, amount: float,
                           transaction_type: str,
                           recipient_phone: str = None) -> dict:
        """Record transaction and return rule-based anomaly score."""
        conn = self.get_connection()
        c = conn.cursor()
        try:
            c.execute('''
                SELECT amount, timestamp FROM transaction_history
                WHERE user_phone = %s
                ORDER BY timestamp DESC LIMIT 50
            ''', (phone_number,))
            history = c.fetchall()

            score = self._calculate_anomaly_score(amount, history)
            is_anomalous = score >= self.ANOMALY_THRESHOLD

            c.execute('''
                INSERT INTO transaction_history
                (user_phone, amount, transaction_type, recipient_phone, fraud_score)
                VALUES (%s, %s, %s, %s, %s)
            ''', (phone_number, float(amount), transaction_type, recipient_phone, float(score)))
            conn.commit()

            return {
                "anomaly_score"          : round(score, 4),
                "is_anomalous"           : is_anomalous,
                "requires_verification"  : is_anomalous,
                "message"                : ("Unusual transaction pattern detected -- "
                                            "face verification required."
                                            if is_anomalous else "Normal transaction pattern.")
            }
        except Exception as e:
            return {"anomaly_score": 0.5, "is_anomalous": False,
                    "requires_verification": False, "error": str(e)}
        finally:
            conn.close()

    def _calculate_anomaly_score(self, amount: float, history: list) -> float:
        if not history:
            return 0.4   # first transaction: slight caution

        amounts = [h[0] for h in history]
        mean_amt = np.mean(amounts)
        std_amt  = np.std(amounts)

        # Z-score component
        z = abs(amount - mean_amt) / std_amt if std_amt > 0 else 0
        score = min(z / 3.0, 1.0)

        # Large amount bonus
        if mean_amt > 0 and amount > mean_amt * 8:
            score = min(score + 0.25, 1.0)

        # Round-number pattern (large multiples of 50k)
        if amount >= 50_000 and amount % 50_000 == 0:
            score = min(score + 0.10, 1.0)

        # Very late-night transaction (midnight-4am)
        hour = datetime.now().hour
        if hour < 4 or hour >= 23:
            score = min(score + 0.10, 1.0)

        return score

    def get_user_transaction_pattern(self, phone_number: str, days: int = 30) -> dict | None:
        conn = self.get_connection()
        c = conn.cursor()
        # Use last 20 completed transactions (not time-based) for a stable baseline
        c.execute('''
            SELECT amount, transaction_type, timestamp
            FROM transaction_history
            WHERE user_phone = %s
            ORDER BY timestamp DESC
            LIMIT 20
        ''', (phone_number,))
        rows = c.fetchall()
        conn.close()
        if not rows:
            return None
        df = pd.DataFrame(rows, columns=["amount", "type", "timestamp"])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return {
            "avg_amount"       : float(df["amount"].mean()),
            "median_amount"    : float(df["amount"].median()),
            "max_amount"       : float(df["amount"].max()),
            "min_amount"       : float(df["amount"].min()),
            "transaction_count": len(df),
            "daily_avg"        : float(df.groupby(df["timestamp"].dt.date).size().mean()),
        }


# 
# 4. PIN MONITORING SYSTEM
# 
class PinMonitoringSystem:
    def __init__(self, user_system: UserRegistrationSystem):
        self.user_system = user_system

    @property
    def db_config(self):
        return self.user_system.db_config
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def record_pin_attempt(self, phone_number: str, was_successful: bool,
                           ip_address: str = None, device_id: str = None) -> dict:
        conn = self.get_connection()
        c = conn.cursor()
        try:
            c.execute('''
                INSERT INTO pin_attempts (user_phone, was_successful, ip_address, device_id)
                VALUES (%s, %s, %s, %s)
            ''', (phone_number, was_successful, ip_address, device_id))
            suspicious = self._check_suspicious(phone_number, c)
            conn.commit()
            return suspicious
        except Exception as e:
            return {"requires_verification": True, "risk_level": "error", "error": str(e)}
        finally:
            conn.close()

    def _check_suspicious(self, phone_number: str, cursor) -> dict:
        cursor.execute('''
            SELECT COUNT(*) FROM pin_attempts
            WHERE user_phone = %s AND was_successful = FALSE
              AND attempt_time >= NOW() - INTERVAL '5 minutes'
        ''', (phone_number,))
        recent_fail = cursor.fetchone()[0]

        cursor.execute('''
            SELECT COUNT(*) FROM pin_attempts
            WHERE user_phone = %s AND was_successful = FALSE
              AND attempt_time >= NOW() - INTERVAL '1 hour'
        ''', (phone_number,))
        hour_fail = cursor.fetchone()[0]

        if recent_fail >= 2:
            return {"requires_verification": True, "risk_level": "high",
                    "message": "Multiple rapid PIN failures -- possible SIM theft."}
        elif hour_fail >= 3:
            return {"requires_verification": True, "risk_level": "medium",
                    "message": "Repeated PIN failures in last hour."}
        return {"requires_verification": False, "risk_level": "low",
                "message": "Normal PIN activity."}

    def get_pin_security_status(self, phone_number: str) -> dict:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            SELECT was_successful, attempt_time
            FROM pin_attempts
            WHERE user_phone = %s
            ORDER BY attempt_time DESC LIMIT 10
        ''', (phone_number,))
        rows = c.fetchall()
        conn.close()

        failed = sum(1 for r in rows if not r[0])
        score  = max(100 - failed * 15, 0)
        if rows and failed / len(rows) > 0.5:
            score = max(score - 20, 0)

        return {
            "recent_attempts": len(rows),
            "failed_attempts": failed,
            "last_attempt"   : rows[0][1] if rows else None,
            "security_score" : score,
        }


# 
# 5. FRAUD ALERT SYSTEM  (notifies service provider in real time)
# 
class FraudAlertSystem:
    """
    Sends structured alerts to the service provider dashboard whenever
    the ML model or rule engine flags a suspicious transaction.

    In production this would POST to an SMS gateway or push-notification
    service.  For now alerts are logged to the database and returned in
    the API response so the dashboard can display them.
    """

    def __init__(self, db_config):
        self.db_config = db_config
        self._ensure_table()
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def _ensure_table(self):
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS fraud_alerts (
                id             SERIAL PRIMARY KEY,
                phone_number   TEXT,
                amount         REAL,
                fraud_score    REAL,
                risk_level     TEXT,
                action         TEXT,
                alert_message  TEXT,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                acknowledged   BOOLEAN DEFAULT FALSE,
                explanation    TEXT
            )
        ''')
        # Safe migration: add explanation column if it was created without it
        try:
            c.execute("ALTER TABLE fraud_alerts ADD COLUMN IF NOT EXISTS explanation TEXT")
        except Exception:
            pass
        conn.commit()
        c.close()
        conn.close()

    def raise_alert(self, phone_number: str, amount: float,
                    fraud_score: float, risk_level: str,
                    action: str, extra_info: str = "",
                    explanation: dict = None) -> dict:
        """Log a fraud alert with optional SHAP explanation and return the alert record."""
        msg = (
            f"[FRAUD ALERT] Phone: {phone_number} | "
            f"Amount: {amount:,.0f} RWF | Score: {fraud_score:.3f} | "
            f"Risk: {risk_level} | Action: {action}. {extra_info}"
        )
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            INSERT INTO fraud_alerts
            (phone_number, amount, fraud_score, risk_level, action, alert_message, explanation)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (phone_number, amount, fraud_score, risk_level, action, msg,
              json.dumps(explanation) if explanation else None))
        alert_id = c.fetchone()[0]
        conn.commit()
        c.close()
        conn.close()

        print(f"[FRAUD ALERT] {msg}")
        return {"alert_id": alert_id, "message": msg, "timestamp": datetime.now().isoformat()}

    def get_unacknowledged_alerts(self) -> list:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute('''
            SELECT id, phone_number, amount, fraud_score, risk_level,
                   action, alert_message, created_at, explanation
            FROM fraud_alerts WHERE acknowledged = FALSE
            ORDER BY created_at DESC
        ''')
        rows = c.fetchall()
        c.close()
        conn.close()
        return [
            {
                "id"          : r[0],
                "phone_number": r[1],   # admin/provider dashboards use phone_number
                "phone"       : r[1],   # keep phone alias for backward compat
                "amount"      : r[2] or 0,
                "fraud_score" : r[3],
                "risk_level"  : r[4],
                "action"      : r[5],
                "message"     : r[6],
                "alert_message": r[6],  # alias so both field names work in frontend
                "created_at"  : r[7].isoformat() if r[7] else None,
                "explanation" : r[8] if isinstance(r[8], dict) else (json.loads(r[8]) if r[8] else None),
            }
            for r in rows
        ]

    def acknowledge_alert(self, alert_id: int) -> dict:
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("UPDATE fraud_alerts SET acknowledged = TRUE WHERE id = %s", (alert_id,))
        conn.commit()
        c.close()
        conn.close()
        return {"success": True, "alert_id": alert_id}

    def update_alert(self, alert_id: int, new_action: str, extra_info: str) -> dict:
        """Update an existing alert's action and message (e.g. REQUIRE_FACE -> BLOCK after face fail)."""
        conn = self.get_connection()
        c = conn.cursor()
        # Get existing message and update it
        c.execute("SELECT alert_message, phone_number, amount, fraud_score, risk_level FROM fraud_alerts WHERE id=%s",
                  (alert_id,))
        row = c.fetchone()
        if row:
            orig_msg, phone, amount, score, risk = row
            # Rebuild message with updated action and appended extra_info
            new_msg = orig_msg.replace(f"Action: {orig_msg.split('Action: ')[-1].split('.')[0]}",
                                       f"Action: {new_action}")
            if extra_info and extra_info not in new_msg:
                new_msg = new_msg.rstrip('. ') + f". {extra_info}"
            c.execute(
                "UPDATE fraud_alerts SET action=%s, alert_message=%s, risk_level='HIGH' WHERE id=%s",
                (new_action, new_msg, alert_id)
            )
        conn.commit()
        conn.close()
        return {"success": True, "alert_id": alert_id}


def _build_fraud_reason(phone_number: str, amount: float, ml_score: float,
                         db_config: dict) -> str:
    """
    Used in fraud_alerts.alert_message so admin can understand what happened.
    """
    try:
        conn = psycopg2.connect(**db_config)
        c = conn.cursor()

        # Get sender balance
        c.execute("SELECT account_balance FROM users WHERE phone_number=%s", (phone_number,))
        row = c.fetchone()
        balance = row[0] if row else 0.0

        # Rapid transfers in last 60 seconds
        c.execute("""
            SELECT COUNT(*) FROM transaction_history
            WHERE user_phone = %s
              AND timestamp >= NOW() - INTERVAL '60 seconds'
        """, (phone_number,))
        rapid = c.fetchone()[0] or 0

        # Rapid transfers in last 5 minutes
        c.execute("""
            SELECT COUNT(*) FROM transaction_history
            WHERE user_phone = %s
              AND timestamp >= NOW() - INTERVAL '5 minutes'
        """, (phone_number,))
        rapid_5m = c.fetchone()[0] or 0
        conn.close()

        reasons = []

        if balance > 0:
            ratio = amount / balance
            if ratio >= 2.0:
                reasons.append(f"Amount is {ratio:.1f}x above balance ({balance:,.0f} RWF) -- extreme overspend")
            elif ratio >= 1.0:
                reasons.append(f"Amount ({amount:,.0f} RWF) exceeds balance ({balance:,.0f} RWF) -- insufficient funds attempted twice")
            elif ratio >= 0.95:
                reasons.append(f"Amount drains nearly full balance ({balance:,.0f} RWF) -- drain pattern")
        elif amount > 0:
            reasons.append(f"Amount {amount:,.0f} RWF attempted with zero balance")

        if rapid >= 5:
            reasons.append(f"{rapid} rapid transfers in last 60 seconds -- velocity fraud")
        elif rapid >= 3:
            reasons.append(f"{rapid} transfers in last 60 seconds -- suspicious frequency")
        elif rapid_5m >= 8:
            reasons.append(f"{rapid_5m} transfers in last 5 minutes -- high frequency")

        if not reasons:
            reasons.append(f"ML model flagged transaction (score={ml_score:.3f})")

        return " | ".join(reasons)

    except Exception as e:
        return f"ML fraud score={ml_score:.3f}"


def _build_xai_summary(top_factors: list, fraud_prob: float,
                        threshold: float) -> str:
    """Build a plain-English summary of the top SHAP factors."""
    risk_word = "HIGH" if fraud_prob >= 0.65 else "MEDIUM" if fraud_prob >= threshold else "LOW"
    lines = [f"Fraud risk: {risk_word} ({fraud_prob*100:.1f}%). "
             f"Top reasons this transaction was flagged:"]
    for f in top_factors[:3]:
        direction = "raised" if f["direction"] == "increases_risk" else "lowered"
        lines.append(f"• {f['label']} {direction} the risk score "
                     f"(impact: {abs(f['shap_value']):.3f})")
    return " ".join(lines)


def _rule_based_explanation(features: list, feature_names: list,
                             feature_labels: dict, fraud_prob: float,
                             threshold: float) -> dict:
    """
    Fallback explanation when SHAP is unavailable.
    Uses known high-signal features to generate a human-readable explanation.
    """
    feat = dict(zip(feature_names, features))
    reasons = []

    if feat.get("is_amount_spike", 0) == 1:
        reasons.append({
            "label"      : "Unusual Amount Spike",
            "detail"     : f"Amount is {feat.get('amount_vs_typical', 0):.1f}x your typical transaction",
            "direction"  : "increases_risk",
            "shap_value" : 0.8,
        })
    if feat.get("sender_zero_after", 0) == 1:
        reasons.append({
            "label"      : "Account Drained to Zero",
            "detail"     : "This transfer would empty your entire account balance",
            "direction"  : "increases_risk",
            "shap_value" : 0.7,
        })
    if feat.get("pin_near_lockout", 0) == 1:
        reasons.append({
            "label"      : "PIN Near Lockout",
            "detail"     : "Multiple recent PIN failures detected on this account",
            "direction"  : "increases_risk",
            "shap_value" : 0.6,
        })
    if feat.get("amount_exceeds_balance", 0) == 1:
        reasons.append({
            "label"      : "Amount Exceeds Balance",
            "detail"     : "Transfer amount is greater than available balance",
            "direction"  : "increases_risk",
            "shap_value" : 0.9,
        })
    if feat.get("amount_to_bal_ratio", 0) > 0.8:
        reasons.append({
            "label"      : "High Balance Drain Ratio",
            "detail"     : f"{feat.get('amount_to_bal_ratio', 0)*100:.0f}% of balance being transferred",
            "direction"  : "increases_risk",
            "shap_value" : round(float(feat.get("amount_to_bal_ratio", 0)) * 0.5, 4),
        })

    if not reasons:
        reasons.append({
            "label"      : "ML Pattern Detection",
            "detail"     : f"Transaction pattern scored {fraud_prob*100:.1f}% fraud probability",
            "direction"  : "increases_risk",
            "shap_value" : round(fraud_prob, 4),
        })

    risk_word = "HIGH" if fraud_prob >= 0.65 else "MEDIUM" if fraud_prob >= threshold else "LOW"
    return {
        "available"  : True,
        "method"     : "Rule-Based (SHAP unavailable -- pip install shap)",
        "fraud_score": round(fraud_prob, 4),
        "threshold"  : threshold,
        "top_factors": reasons,
        "summary"    : f"Fraud risk: {risk_word} ({fraud_prob*100:.1f}%). "
                       + " | ".join(r["label"] for r in reasons[:3]),
    }


# 
# 6. REAL-TIME FRAUD DETECTOR  (main engine, used by money_transfer.py)
# 
class RealTimeFraudDetector:
    """
    Pipeline:
      1. Check user is active (not abroad, not locked)
      2. ML model score ONLY (trained in Momo_Clean.ipynb, saved as .pkl)
         -- fraud decision comes entirely from the trained model, no hand-written rules
      3. If HIGH risk  -> block + raise alert + require face verification
         If MEDIUM     -> require face verification before proceeding
         If LOW        -> allow

    NOTE: Rule-based anomaly scoring and PIN-risk weighting are intentionally
    NOT used in the fraud decision. The ML model is the sole judge.
    TransactionAnomalyDetector.record_transaction() is still called to LOG
    the transaction to transaction_history (needed for ML feature building),
    but its anomaly_score does NOT influence the fraud decision -- the ML model is the sole judge.
    """

    # Risk thresholds (combined score 0-1)
    HIGH_RISK_THRESHOLD   = 0.65
    MEDIUM_RISK_THRESHOLD = 0.40

    def __init__(self, db_config):
        self.db_config = db_config
        self.user_reg = UserRegistrationSystem(db_config)
        self.travel_sys = TravelMonitoringSystem(self.user_reg)
        self.anomaly_det = TransactionAnomalyDetector(self.user_reg)
        self.pin_monitor = PinMonitoringSystem(self.user_reg)
        self.alert_sys = FraudAlertSystem(db_config)
        self._load_ml_model()
    
    def get_connection(self):
        """Create and return a PostgreSQL database connection."""
        return psycopg2.connect(**self.db_config)

    def _load_ml_model(self):
        self.model     = None
        self.scaler    = None
        self.config    = {}
        self.threshold = 0.5
        self.explainer = None   # SHAP TreeExplainer -- loaded lazily
        try:
            self.model  = joblib.load("fraud_best_model.pkl")
            self.scaler = joblib.load("fraud_scaler.pkl")
            with open("fraud_config.json") as f:
                self.config = json.load(f)
            self.threshold = self.config.get("threshold", 0.5)
            print(f"[FraudDetector] ML model loaded: {self.config.get('best_model')} "
                  f"| threshold={self.threshold}")
            # Pre-load SHAP explainer if available
            try:
                import shap
                self.explainer = shap.TreeExplainer(self.model)
                print("[FraudDetector] SHAP TreeExplainer loaded -- XAI enabled")
            except ImportError:
                print("[FraudDetector] SHAP not installed -- XAI disabled (pip install shap)")
            except Exception as e:
                print(f"[FraudDetector] SHAP explainer failed to load: {e}")
        except FileNotFoundError:
            print("[FraudDetector] ML model not found -- using rule-based detection only.")
        except Exception as e:
            print(f"[FraudDetector] Error loading model: {e}")

    #  Feature builder 

    def _build_ml_features(self, phone_number: str, amount: float,
                            network: str) -> list:
        """
        Build the 20-feature vector that matches fraud_config.json FEATURES list:
        log_amount, log_oldbalanceOrg, log_newbalanceOrig, log_oldbalanceDest,
        log_newbalanceDest, orig_balance_drop, dest_balance_gain, balance_mismatch,
        sender_zero_after, dest_zero_before, amount_to_bal_ratio, type_encoded,
        hour_of_day, is_high_amount, amount_vs_typical, is_amount_spike,
        pin_near_lockout, amount_exceeds_balance, hard_block_signal, excess_ratio
        """
        # Get live balance (sender)
        conn = self.get_connection()
        c = conn.cursor()
        c.execute("SELECT account_balance FROM users WHERE phone_number = %s",
                  (phone_number,))
        row = c.fetchone()

        # Get PIN fail count for pin_near_lockout feature
        c.execute("SELECT COALESCE(pin_fail_count, 0) FROM users WHERE phone_number = %s",
                  (phone_number,))
        pin_row = c.fetchone()

        # Get recipient balance — used for dest_zero_before and log_old_dest features
        # These were trained on PaySim data where recipient balance is meaningful signal.
        # We look up by recipient_phone passed to evaluate_transaction; fall back to 0.
        # Note: recipient_phone is not in the function signature, so we store it on the
        # class temporarily via evaluate_transaction or use a default of 0 when unknown.
        dest_balance = 0.0
        if hasattr(self, '_current_recipient_phone') and self._current_recipient_phone:
            c.execute("SELECT account_balance FROM users WHERE phone_number = %s",
                      (self._current_recipient_phone,))
            dest_row = c.fetchone()
            if dest_row:
                dest_balance = dest_row[0]

        conn.close()

        old_balance   = row[0] if row else 0.0
        pin_fail_count = pin_row[0] if pin_row else 0
        new_balance   = max(old_balance - amount, 0.0)

        # Historical pattern
        pattern    = self.anomaly_det.get_user_transaction_pattern(phone_number)
        # Use median as the baseline -- it's robust against outlier large transfers
        # that would inflate the mean and hide genuine spikes.
        # If no history yet, default to 500 RWF so that transfers over 2,500 RWF
        # (5x baseline) still register as a spike on the very first transaction.
        if pattern:
            avg_amount = pattern.get("median_amount") or pattern["avg_amount"]
        else:
            avg_amount = 500.0   # safe default: 5x = 2,500 RWF spike threshold

        # Derived features
        dest_new_balance    = dest_balance + amount
        log_amount          = np.log1p(amount)
        log_old_orig        = np.log1p(old_balance)
        log_new_orig        = np.log1p(new_balance)
        log_old_dest        = np.log1p(dest_balance)
        log_new_dest        = np.log1p(dest_new_balance)
        orig_balance_drop   = log_old_orig - log_new_orig
        dest_balance_gain   = log_new_dest - log_old_dest
        balance_mismatch    = orig_balance_drop - dest_balance_gain
        sender_zero_after   = int(new_balance == 0)
        dest_zero_before    = int(dest_balance == 0)
        amount_to_bal_ratio = amount / (old_balance + 1)

        type_map     = {"MTN": 4, "Airtel": 4}
        type_encoded = type_map.get(network, 4)
        hour_of_day  = datetime.now().hour
        is_high_amount = int(amount > 100_000)

        # amount_vs_typical: ratio of this amount to user's average (capped at 10)
        amount_vs_typical = min(amount / (avg_amount + 1), 10.0)

        # is_amount_spike: 1 if amount > 5x user's average
        is_amount_spike = int(amount > 5 * (avg_amount + 1))

        # pin_near_lockout: 1 if user has 2+ failed PIN attempts (one away from lockout)
        pin_near_lockout = int(pin_fail_count >= 2)

        # amount_exceeds_balance: 1 if amount > current balance
        amount_exceeds_balance = int(amount > old_balance)

        # hard_block_signal: 1 if amount > balance AND pin_near_lockout
        hard_block_signal = int(amount_exceeds_balance and pin_near_lockout)

        # excess_ratio: how much over balance (capped at 10)
        excess_ratio = min(amount / (old_balance + 1), 10.0)

        # Feature order must match fraud_config.json exactly:
        return [
            log_amount,             # 0  log_amount
            log_old_orig,           # 1  log_oldbalanceOrg
            log_new_orig,           # 2  log_newbalanceOrig
            log_old_dest,           # 3  log_oldbalanceDest
            log_new_dest,           # 4  log_newbalanceDest
            orig_balance_drop,      # 5  orig_balance_drop
            dest_balance_gain,      # 6  dest_balance_gain
            balance_mismatch,       # 7  balance_mismatch
            sender_zero_after,      # 8  sender_zero_after
            dest_zero_before,       # 9  dest_zero_before
            amount_to_bal_ratio,    # 10 amount_to_bal_ratio
            type_encoded,           # 11 type_encoded
            hour_of_day,            # 12 hour_of_day
            is_high_amount,         # 13 is_high_amount
            amount_vs_typical,      # 14 amount_vs_typical
            is_amount_spike,        # 15 is_amount_spike
            pin_near_lockout,       # 16 pin_near_lockout
            amount_exceeds_balance, # 17 amount_exceeds_balance
            hard_block_signal,      # 18 hard_block_signal
            excess_ratio,           # 19 excess_ratio
        ]

    #  ML scoring 

    def ml_score(self, phone_number: str, amount: float, network: str) -> float:
        """Return ML fraud probability (0-1). Falls back to 0.5 on error."""
        if not self.model or not self.scaler:
            return 0.5
        try:
            import warnings
            features = self._build_ml_features(phone_number, amount, network)
            vec      = np.array([features])
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                vec_s = self.scaler.transform(vec)
            return float(self.model.predict_proba(vec_s)[0][1])
        except Exception as e:
            print(f"[MLScore] Error: {e}")
            return 0.5

    def explain_transaction(self, phone_number: str, amount: float,
                             network: str, mode: str = "standard") -> dict:
        """
        Generate an explanation for a transaction's fraud score.

        mode="standard"  -> Rule-based (primary) + feature importance (secondary).
                           Fast, always works. Used for manager fraud alerts.
        mode="deep"      -> Adds SHAP values on top of standard.
                           Slower, requires SHAP. Used for admin deep-dive only.
        """
        feature_names = self.config.get("features", [
            "log_amount","log_oldbalanceOrg","log_newbalanceOrig",
            "log_oldbalanceDest","log_newbalanceDest","orig_balance_drop",
            "dest_balance_gain","balance_mismatch","sender_zero_after",
            "dest_zero_before","amount_to_bal_ratio","type_encoded",
            "hour_of_day","is_high_amount","amount_vs_typical",
            "is_amount_spike","pin_near_lockout","amount_exceeds_balance",
            "hard_block_signal","excess_ratio"
        ])

        feature_labels = {
            "log_amount"             : "Transaction Amount",
            "log_oldbalanceOrg"      : "Sender Balance (Before)",
            "log_newbalanceOrig"     : "Sender Balance (After)",
            "log_oldbalanceDest"     : "Recipient Balance (Before)",
            "log_newbalanceDest"     : "Recipient Balance (After)",
            "orig_balance_drop"      : "Sender Balance Drop",
            "dest_balance_gain"      : "Recipient Balance Gain",
            "balance_mismatch"       : "Balance Mismatch",
            "sender_zero_after"      : "Account Drained to Zero",
            "dest_zero_before"       : "Recipient Had Zero Balance",
            "amount_to_bal_ratio"    : "Amount vs. Balance Ratio",
            "type_encoded"           : "Transaction Type",
            "hour_of_day"            : "Time of Day",
            "is_high_amount"         : "High Amount Flag",
            "amount_vs_typical"      : "Amount vs. Typical Behaviour",
            "is_amount_spike"        : "Unusual Amount Spike",
            "pin_near_lockout"       : "PIN Near Lockout",
            "amount_exceeds_balance" : "Amount Exceeds Balance",
            "hard_block_signal"      : "Hard Block Signal",
            "excess_ratio"           : "Excess Ratio",
        }

        try:
            features  = self._build_ml_features(phone_number, amount, network)
            feat_dict = dict(zip(feature_names, features))

            #  Get fraud probability 
            if self.model and self.scaler:
                import warnings
                vec = np.array([features])
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    vec_s = self.scaler.transform(vec)
                fraud_prob = float(self.model.predict_proba(vec_s)[0][1])
            else:
                fraud_prob = 0.5

            #  PRIMARY: Rule-based explanation 
            # Always generated -- fast, human-readable, no dependencies
            rule_exp = _rule_based_explanation(
                features, feature_names, feature_labels, fraud_prob, self.threshold)

            #  SECONDARY: Feature importance 
            # Uses model's built-in feature importances -- no SHAP needed
            feature_importance_factors = []
            if self.model and hasattr(self.model, 'feature_importances_'):
                importances = self.model.feature_importances_
                fi_pairs = sorted(
                    zip(feature_names, importances, features),
                    key=lambda x: x[1], reverse=True
                )
                for name, imp, raw_val in fi_pairs[:5]:
                    feature_importance_factors.append({
                        "feature"    : name,
                        "label"      : feature_labels.get(name, name),
                        "importance" : round(float(imp), 4),
                        "raw_value"  : round(float(raw_val), 4),
                        "shap_value" : round(float(imp), 4),  # use importance as proxy
                        "direction"  : "increases_risk" if raw_val > 0 else "decreases_risk",
                    })

            # Build the standard result
            # top_factors = rule-based reasons PLUS feature importance to always show 5 bars
            rule_factors = rule_exp["top_factors"]
            fi_labels = {f["feature"]: f for f in feature_importance_factors}

            # Merge: rule factors first, then fill with feature importance (no duplicates)
            seen_labels = {f["label"] for f in rule_factors}
            combined_factors = list(rule_factors)
            for fi in feature_importance_factors:
                if fi["label"] not in seen_labels and len(combined_factors) < 5:
                    combined_factors.append(fi)
                    seen_labels.add(fi["label"])

            result = {
                "available"    : True,
                "method"       : "Rule-Based + Feature Importance",
                "fraud_score"  : round(fraud_prob, 4),
                "threshold"    : self.threshold,
                "top_factors"  : combined_factors,
                "feature_importance": feature_importance_factors,
                "summary"      : rule_exp["summary"],
                "triggered_rules": {
                    "amount_spike"        : int(feat_dict.get("is_amount_spike", 0)),
                    "account_drain"       : int(feat_dict.get("sender_zero_after", 0)),
                    "pin_near_lockout"    : int(feat_dict.get("pin_near_lockout", 0)),
                    "exceeds_balance"     : int(feat_dict.get("amount_exceeds_balance", 0)),
                    "high_drain_ratio"    : int(feat_dict.get("amount_to_bal_ratio", 0) > 0.8),
                    "amount_vs_typical"   : round(float(feat_dict.get("amount_vs_typical", 0)), 2),
                },
            }

            #  DEEP MODE: Add SHAP (admin only) 
            if mode == "deep" and self.explainer is not None and self.model and self.scaler:
                try:
                    import warnings
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        shap_values = self.explainer.shap_values(vec_s)
                    sv = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
                    shap_factors = []
                    for name, sv_val, raw_val in zip(feature_names, sv, features):
                        shap_factors.append({
                            "feature"    : name,
                            "label"      : feature_labels.get(name, name),
                            "shap_value" : round(float(sv_val), 4),
                            "raw_value"  : round(float(raw_val), 4),
                            "direction"  : "increases_risk" if sv_val > 0 else "decreases_risk",
                        })
                    shap_factors.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
                    result["shap_factors"] = shap_factors[:10]
                    result["all_factors"]  = shap_factors
                    result["method"]       = "Rule-Based + Feature Importance + SHAP"
                    # Override top_factors with SHAP for deep mode
                    result["top_factors"]  = shap_factors[:5]
                except Exception as shap_err:
                    result["shap_error"] = str(shap_err)

            return result

        except Exception as e:
            return {
                "available"  : False,
                "error"      : f"Explanation unavailable: {e}",
                "fraud_score": 0.5,
            }

    #  Main check 

    def evaluate_transaction(self, phone_number: str, amount: float,
                             recipient_phone: str, network: str,
                             face_base64: str = None,
                             untrusted: bool = False) -> dict:
        """
        Full fraud pipeline.  Called by money_transfer.py BEFORE deducting
        balance.  Returns:
          {
            "action"        : "ALLOW" | "REQUIRE_FACE" | "BLOCK",
            "risk_level"    : "LOW"   | "MEDIUM"       | "HIGH",
            "fraud_score"   : float,  # combined 0-1
            "ml_score"      : float,
            "rule_score"    : float,
            "face_verified" : bool | None,
            "alert"         : dict | None,
            "message"       : str,
            "checks"        : dict,   # per-check detail
          }

        untrusted=True is set by money_transfer.py when the user previously
        attempted a transfer that exceeded their balance but now the amount
        fits.  This forces face verification regardless of ML score.
        """
        checks = {}
        result = {
            "action"       : "ALLOW",
            "risk_level"   : "LOW",
            "fraud_score"  : 0.0,
            "ml_score"     : 0.0,
            "rule_score"   : 0.0,
            "face_verified": None,
            "alert"        : None,
            "message"      : "",
            "checks"       : checks,
        }

        #  1. User active%s 
        user = self.user_reg.get_user_info(phone_number)
        if not user:
            checks["user"] = {"passed": False, "msg": "User not found"}
            result.update({"action": "BLOCK", "risk_level": "HIGH",
                           "message": "User not found."})
            return result
        if not user["is_active"]:
            # Genuine deactivation — block immediately
            checks["user"] = {"passed": False, "msg": "Account inactive"}
            result.update({"action": "BLOCK", "risk_level": "HIGH",
                           "message": "Your account is currently inactive. "
                                      "Please contact your service provider to reactivate."})
            return result
        checks["user"] = {"passed": True, "msg": f"Active user: {user['full_name']}"}

        #  2. ML is the sole judge -- no hard balance-multiplier rule 
        #   The model was trained on excess_ratio and amount_exceeds_balance
        #   features, so 2x / 3x above balance is detected by ML alone.
        checks["balance_multiplier"] = {"passed": True, "msg": "Delegated to ML model"}

        #  3. Travel check 
        # Users with travel_status='abroad' are NOT blocked — they require mandatory
        # face verification plus an email notification.
        is_abroad = (user.get("travel_status") == "abroad") or self.travel_sys.is_user_abroad(phone_number)
        if is_abroad:
            checks["travel"] = {
                "passed": False,
                "msg": "User is registered as abroad — face verification required."
            }
            # If no face provided yet, require it (with email notification handled in money_transfer.py)
            if not face_base64:
                result.update({
                    "action"    : "REQUIRE_FACE",
                    "risk_level": "HIGH",
                    "message"   : (
                        "Your account is registered as abroad. "
                        "For your security, please verify your face to continue this transfer. "
                        "A notification has been sent to your registered email address."
                    ),
                    "travel_abroad": True,
                })
                self.alert_sys.raise_alert(
                    phone_number, amount, 1.0, "HIGH", "REQUIRE_FACE",
                    "Transfer attempted while registered abroad — face verification required.")
                result["alert"] = True
                return result
            # Face was provided — verify it before continuing
            face_result = self.user_reg.verify_face_from_base64(phone_number, face_base64)
            result["face_verified"] = face_result.get("verified", False)
            checks["face_travel"] = face_result
            if not result["face_verified"]:
                face_error = face_result.get("error", "Transaction failed because you are not the owner of this account.")
                result.update({
                    "action"    : "BLOCK",
                    "risk_level": "HIGH",
                    "message"   : face_error,
                })
                self.alert_sys.raise_alert(
                    phone_number, amount, 1.0, "HIGH", "BLOCK",
                    f"Face verification failed on abroad transfer attempt — {face_error}")
                result["alert"] = True
                return result
            # Face matched — mark as verified and continue to ML scoring
            checks["travel"] = {
                "passed": True,
                "msg"   : "Abroad user — identity confirmed via face verification."
            }
        else:
            checks["travel"] = {"passed": True, "msg": "User is in country"}

        #  4. ML model score -- SOLE fraud decision 
        #   Build features ONCE and reuse for both ML scoring and behavioural override.
        #   This prevents the double-build race condition where record_transaction
        #   writes to history between the first and second _build_ml_features call,
        #   causing the spike check to see a different baseline than the ML score used.
        self._current_recipient_phone = recipient_phone
        try:
            shared_feats = self._build_ml_features(phone_number, amount, network)
        except Exception:
            shared_feats = None
        self._current_recipient_phone = None

        # Score using the shared feature vector
        if shared_feats is not None and self.model and self.scaler:
            try:
                import warnings
                vec = np.array([shared_feats])
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    vec_s = self.scaler.transform(vec)
                ml_s = float(self.model.predict_proba(vec_s)[0][1])
            except Exception as e:
                print(f"[MLScore] Error: {e}")
                ml_s = 0.5
        else:
            ml_s = self.ml_score(phone_number, amount, network)

        checks["ml_model"] = {
            "score"    : round(ml_s, 4),
            "threshold": self.threshold,
            "msg"      : f"ML fraud probability: {ml_s:.4f}"
        }

        #  5. Log transaction to history AFTER scoring 
        #   record_transaction() writes to transaction_history for future
        #   ML feature building. Logging AFTER scoring prevents the current
        #   transaction from inflating avg_amount before the spike check.
        anomaly = self.anomaly_det.record_transaction(
            phone_number, amount, "TRANSFER", recipient_phone)
        checks["transaction_logged"] = {
            "passed": True,
            "msg"   : "Transaction recorded for ML feature history."
        }

        #  6. Fraud score = ML score only 
        combined = round(ml_s, 4)

        result["fraud_score"] = combined
        result["ml_score"]    = round(ml_s, 4)
        result["rule_score"]  = 0.0   # not used in decision

        #  7. Risk classification 
        # Primary: ML score thresholds
        # Override: explicit behavioural signals that always require face
        #   regardless of ML score (the model was trained on PaySim data
        #   and may not score small-account spikes high enough).
        if combined >= self.HIGH_RISK_THRESHOLD:
            result["risk_level"] = "HIGH"
        elif combined >= self.MEDIUM_RISK_THRESHOLD:
            result["risk_level"] = "MEDIUM"
        else:
            result["risk_level"] = "LOW"

        #  Behavioural override: force REQUIRE_FACE on clear spike signals 
        # Reuse the already-built feature vector — do NOT rebuild here.
        # Rebuilding after record_transaction() would see the current transaction
        # in history, inflating the median and hiding the spike.
        try:
            feats    = shared_feats if shared_feats is not None else []
            is_spike = feats[15] if len(feats) > 15 else 0  # is_amount_spike
            is_drain = feats[8]  if len(feats) > 8  else 0  # sender_zero_after

            # Also catch moderate spikes (3x) that the ML model may miss on
            # small-account users because PaySim trained on larger USD amounts
            avg_amount_check = 0
            pattern = self.anomaly_det.get_user_transaction_pattern(phone_number)
            if pattern:
                avg_amount_check = pattern.get("median_amount") or pattern["avg_amount"]
            else:
                avg_amount_check = 500.0
            is_moderate_spike = int(amount > 3 * (avg_amount_check + 1))

            if (is_spike or is_moderate_spike) and result["risk_level"] == "LOW":
                result["risk_level"] = "MEDIUM"
                checks["behavioural_override"] = {
                    "reason": "amount_spike",
                    "msg"   : f"Amount is >3x user average — face verification required."
                }
            elif is_drain and result["risk_level"] == "LOW":
                result["risk_level"] = "MEDIUM"
                checks["behavioural_override"] = {
                    "reason": "account_drain",
                    "msg"   : "Transfer would drain account to zero — face verification required."
                }
        except Exception:
            pass  # never block a transaction due to feature-build error

        #  7b. Untrusted user override 
        # If money_transfer.py flagged this user as untrusted (they previously
        # attempted a transfer that exceeded their balance), force face
        # verification even if the ML score would normally ALLOW the transaction.
        if untrusted and result["risk_level"] == "LOW":
            result["risk_level"] = "MEDIUM"   # elevate so face gate triggers
            checks["untrusted_override"] = {
                "active": True,
                "msg": (
                    "User previously attempted a transfer exceeding their balance. "
                    "Face verification required for next transaction."
                )
            }

        #  8. Face verification gate — required for ALL transfers 
        # Every transfer requires face verification regardless of risk level.
        # This ensures identity is confirmed on every transaction.
        # For LOW risk: simple face gate with no fraud alert raised.
        # For MEDIUM/HIGH risk: face gate + fraud alert.
        if face_base64:
            # User has provided face image — verify it
            # Skip re-verification if already verified above (abroad check)
            if result.get("face_verified") is True:
                # Already verified in the abroad check above — just confirm
                result["action"]  = "ALLOW"
                result["message"] = "Face verification passed. Transaction approved."
            else:
                face_result = self.user_reg.verify_face_from_base64(
                    phone_number, face_base64)
                result["face_verified"] = face_result.get("verified", False)
                checks["face"] = face_result

                if result["face_verified"]:
                    extra = (
                        " Your previous over-balance attempt has been cleared."
                        if untrusted else ""
                    )
                    result["risk_level"] = "LOW"
                    result["action"]     = "ALLOW"
                    result["message"]    = f"Face verification passed. Transaction approved.{extra}"
                else:
                    result["action"]  = "BLOCK"
                    # Use the specific error from the face verification — it already
                    # says "not the owner" when the face doesn't match, and gives
                    # technical detail for other failures (corrupted encoding, etc.)
                    face_error = face_result.get("error", "Face verification failed. Transaction blocked for your security.")
                    result["message"] = face_error
                    pending_id = result.get("_alert_id")
                    if pending_id:
                        self.alert_sys.update_alert(pending_id, "BLOCK",
                            f"Face verification failed — {face_error}")
                    else:
                        reason = _build_fraud_reason(phone_number, amount, ml_s, self.db_config)
                        try:
                            xai = self.explain_transaction(phone_number, amount, network)
                        except Exception:
                            xai = None
                        result["alert"] = self.alert_sys.raise_alert(
                            phone_number, amount, combined,
                            "HIGH", "BLOCK",
                            f"{reason}. {face_error}",
                            explanation=xai)
                    result["face_failed"] = True
        else:
            # No face provided yet — always require it (every transfer needs face verification)
            if untrusted and result["risk_level"] == "MEDIUM":
                face_msg = (
                    "A previous transfer attempt exceeded your account balance. "
                    "For your security, please verify your face to continue."
                )
            elif result["risk_level"] == "HIGH":
                face_msg = (
                    "High fraud risk detected. Face verification required before transfer."
                )
            elif result["risk_level"] == "MEDIUM":
                face_msg = (
                    "Unusual activity detected on this transaction. "
                    "Please complete face verification to proceed."
                )
            else:
                # LOW risk — face still required on every transfer
                face_msg = (
                    "Face verification is required to confirm your identity "
                    "before this transfer can proceed."
                )
            result["action"]  = "REQUIRE_FACE"
            result["message"] = face_msg
            # Only raise a fraud alert for MEDIUM/HIGH risk transfers
            if result["risk_level"] in ("MEDIUM", "HIGH"):
                reason = _build_fraud_reason(phone_number, amount, ml_s, self.db_config)
                try:
                    xai = self.explain_transaction(phone_number, amount, network)
                except Exception:
                    xai = None
                result["alert"] = self.alert_sys.raise_alert(
                    phone_number, amount, combined,
                    result["risk_level"], "REQUIRE_FACE",
                    reason, explanation=xai)
                result["_alert_id"] = result["alert"].get("alert_id") if result["alert"] else None

        return result

    #  Convenience wrappers 

    def get_fraud_alerts(self) -> list:
        """Return all unacknowledged alerts (for admin dashboard)."""
        return self.alert_sys.get_unacknowledged_alerts()

    def acknowledge_alert(self, alert_id: int) -> dict:
        return self.alert_sys.acknowledge_alert(alert_id)
