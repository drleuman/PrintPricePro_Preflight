# PrintPrice API v2 — cURL Examples

A collection of ready-to-use cURL commands for testing the PrintPrice Developer Platform.

---

## Jobs API (Single Files)

### 1. Submit a File for Autofix
```bash
curl -X POST https://api.printprice.pro/api/v2/jobs \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@demo.pdf" \
  -F "policy=OFFSET_CMYK_STRICT"
```

### 2. Check Job Status & Metrics
```bash
curl -G https://api.printprice.pro/api/v2/jobs/<job_id> \
  -H "Authorization: Bearer <API_KEY>"
```

### 3. List Recent Jobs
```bash
curl -G https://api.printprice.pro/api/v2/jobs \
  -H "Authorization: Bearer <API_KEY>" \
  -d "limit=5"
```

---

## Batch API (Group Processing)

### 1. Submit a ZIP Archive
```bash
curl -X POST https://api.printprice.pro/api/v2/batches \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@archive.zip"
```

### 2. Monitor Batch Progress
```bash
curl -G https://api.printprice.pro/api/v2/batches/<batch_id> \
  -H "Authorization: Bearer <API_KEY>"
```

### 3. List Batch Child Jobs
```bash
curl -G https://api.printprice.pro/api/v2/batches/<batch_id>/jobs \
  -H "Authorization: Bearer <API_KEY>"
```

### 4. Download Batch Result ZIP
```bash
curl -L https://api.printprice.pro/api/v2/batches/<batch_id>/download \
  -H "Authorization: Bearer <API_KEY>" \
  -o processed_batch.zip
```

---

## Webhook Security

### Header Signature Verification
```bash
X-PrintPrice-Signature: sha256=<hmac_hash>
```
To verify the payload in your backend, compute the HMAC SHA256 of the raw body using your tenant secret.
