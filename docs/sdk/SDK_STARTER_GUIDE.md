# PrintPrice SDK Starter Guide

### What PrintPrice Does
PrintPrice automatically analyzes, fixes, and optimizes print production files. 

Developers use PrintPrice to:
- **Automate Preflight**: Standardize validation across all incoming PDF assets.
- **Auto-Fix Production Issues**: Automatically resolve bleed, color space, and font issues.
- **Reduce Waste**: Detect technical errors before they reach the press.
- **Generate ROI Metrics**: Quantify time and money saved per project.

---

## 1. How it Works

```mermaid
sequenceDiagram
    participant S as Your System
    participant P as PrintPrice API
    participant W as Your Webhook Handler

    S->>P: 1. POST /api/v2/jobs (PDF + Policy)
    P-->>S: 202 Accepted (job_id)
    Note over P: Job Processing (Analyze & Fix)
    P->>W: 2. POST (Webhook: job.completed)
    Note over S: OR
    S->>P: 3. GET /api/v2/jobs/:id (Polling)
    P-->>S: 200 OK (status + download_url)
```

---

## 2. Authentication

The PrintPrice API uses Bearer Token authentication. Include your API Key in the `Authorization` header of all requests.

**Base URL:** `https://api.printprice.pro/api/v2`

```bash
Authorization: Bearer ppk_live_xxxxxxxxxxxx
```

---

## 3. Quickstart (5 Minutes)

### Upload a File
Submit a file for automated analysis and repair:

```bash
curl -X POST https://api.printprice.pro/api/v2/jobs \
  -H "Authorization: Bearer ppk_live_xxx" \
  -F "file=@example.pdf" \
  -F "policy=OFFSET_CMYK_STRICT"
```

### Check Job Status (Polling)
If you are not using webhooks, you can poll the job status:

```bash
curl https://api.printprice.pro/api/v2/jobs/<job_id> \
  -H "Authorization: Bearer ppk_live_xxx"
```

**Success Response Snippet:**
```json
{
  "job_id": "job_abc123",
  "status": "SUCCEEDED",
  "metrics": {
    "risk_score_before": 68,
    "risk_score_after": 12,
    "hours_saved": 0.25,
    "value_generated": 25
  },
  "links": {
    "download_url": "https://storage.printprice.pro/fixed/job_abc123.pdf?..."
  }
}
```

---

## 4. Webhooks & Security

Webhooks are the recommended way to handle production scale. 

### Verifying Webhook Signatures
Every webhook request includes an `X-PrintPrice-Signature` header. You **must** verify this to ensure the payload is authentic.

```javascript
// Node.js Verification Example
const crypto = require('crypto');

function verifyWebhook(rawBody, signature, secret) {
    const expected = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return signature === `sha256=${expected}`;
}
```

### Webhook Payload Example
```json
{
  "event": "job.completed",
  "job_id": "job_abc123",
  "tenant_id": "tenant_001",
  "timestamp": "2026-03-08T12:00:00Z",
  "metrics": {
    "risk_score_before": 68,
    "risk_score_after": 12,
    "hours_saved": 0.25,
    "value_generated": 25
  }
}
```

---

## 5. Error Handling

| Code | Meaning | Resolution |
|------|---------|------------|
| 400 | Invalid File | Ensure the file is a valid, non-corrupt PDF. |
| 401 | Unauthorized | Verify your API Key and header format. |
| 402 | Payment Required | Plan expired or quota exhausted. Check Dashboard. |
| 429 | Too Many Requests | Rate limit exceeded. Implement exponential backoff. |
| 500 | Engine Error | Internal processing error. Contact support. |

---

## 6. Production Best Practices

- **Use Webhooks**: Avoid unnecessary polling to minimize latency and server load.
- **Implement Retries**: Use exponential backoff for failed uploads or network issues.
- **Traceability**: Store the `job_id` in your internal records alongside the order/project ID.
- **Batching**: Use the `/batches` endpoint for processing more than 10 files simultaneously.
- **Security**: Never expose your `ppk_live` keys in client-side code.
