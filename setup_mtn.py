# Run this once to set up your sandbox credentials
import requests
import uuid

DISBURSEMENT_PRIMARY_KEY = "a0d121e0f7bf46dabda14b62b59ee1a8"
reference_id = str(uuid.uuid4())  # Save this!

# Step 1: Create API User
r = requests.post(
    "https://sandbox.momodeveloper.mtn.com/v1_0/apiuser",
    headers={
        "X-Reference-Id": reference_id,
        "Ocp-Apim-Subscription-Key": DISBURSEMENT_PRIMARY_KEY,
        "Content-Type": "application/json"
    },
    json={"providerCallbackHost": "localhost"}
)
print("Create user:", r.status_code)  # Should be 201

# Step 2: Create API Key
r2 = requests.post(
    f"https://sandbox.momodeveloper.mtn.com/v1_0/apiuser/{reference_id}/apikey",
    headers={"Ocp-Apim-Subscription-Key": DISBURSEMENT_PRIMARY_KEY}
)
print("API Key:", r2.json())  # Save the apiKey!

# Add this to setup_mtn.py temporarily to print the reference_id
print("Reference ID:", reference_id)