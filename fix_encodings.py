import psycopg2, face_recognition, numpy as np
from PIL import Image
import io

DB_CONFIG = {
    'dbname': 'momo_fraud', 'user': 'postgres',
    'password': 'Eric@!99', 'host': 'localhost', 'port': '5432'
}

conn = psycopg2.connect(**DB_CONFIG)
c = conn.cursor()
c.execute("SELECT phone_number, face_encoding FROM users WHERE face_encoding IS NOT NULL")
rows = c.fetchall()

fixed = 0
for phone, enc_bytes in rows:
    enc_bytes_raw = bytes(enc_bytes)

    # Check if already a real 128-dim float64 encoding
    try:
        enc = np.frombuffer(enc_bytes_raw, dtype=np.float64)
        if len(enc) == 128:
            print(f"{phone} — already has real encoding, skipping")
            continue
    except ValueError:
        pass  # raw JPEG bytes, continue to fix

    # Re-extract face encoding from raw JPEG
    try:
        img = Image.open(io.BytesIO(enc_bytes_raw)).convert("RGB")
        encs = face_recognition.face_encodings(np.array(img))
        if encs:
            c.execute("UPDATE users SET face_encoding=%s WHERE phone_number=%s",
                      (encs[0].tobytes(), phone))
            conn.commit()
            fixed += 1
            print(f"{phone} — fixed ✓")
        else:
            print(f"{phone} — no face detected in stored image, skipping")
    except Exception as e:
        print(f"{phone} — error: {e}")

conn.close()
print(f"\nDone. Fixed {fixed} users.")