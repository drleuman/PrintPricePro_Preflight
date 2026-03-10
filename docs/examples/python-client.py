"""
PrintPrice API v2 — Python Client Example

Usage:
1. Install requests: pip install requests
2. Set your API Key
3. Run python python-client.py
"""

import requests
import time

API_KEY = "ppk_live_xxx"  # Replace with your real key
BASE_URL = "https://api.printprice.pro/api/v2"

def process_file(file_path):
    print(f"[1/3] Uploading {file_path}...")
    
    headers = {"Authorization": f"Bearer {API_KEY}"}
    files = {"file": open(file_path, "rb")}
    data = {"policy": "OFFSET_CMYK_STRICT"}

    try:
        response = requests.post(f"{BASE_URL}/jobs", headers=headers, files=files, data=data)
        response.raise_for_status()
        
        job_info = response.json()
        job_id = job_info["job_id"]
        print(f"[2/3] Job accepted. ID: {job_id}. Polling...")

        while True:
            status_res = requests.get(f"{BASE_URL}/jobs/{job_id}", headers=headers)
            status_res.raise_for_status()
            
            job_data = status_res.json()
            status = job_data["status"]
            print(f"      Status: {status}...")

            if status == "SUCCEEDED":
                metrics = job_data["metrics"]
                links = job_data["links"]
                print(f"[3/3] Success! Optimization complete.")
                print(f"      Risk Reduction: {metrics['risk_score_before']} -> {metrics['risk_score_after']}")
                print(f"      Download URL: {links['download_url']}")
                break
            elif status == "FAILED":
                print(f"      Error: {job_data.get('error')}")
                break
            
            time.sleep(2)

    except requests.exceptions.HTTPError as e:
        print(f"API Error: {e.response.json().get('error', e)}")
    except Exception as e:
        print(f"Error: {e}")

# Example invocation
# if __name__ == "__main__":
#     process_file("flyer.pdf")
