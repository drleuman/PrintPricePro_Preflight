# Delivery Layer Documentation (Phase 21.2)

The PrintPrice Notification Core supports multiple delivery channels. This document focuses on the technical implementation of Email and Webhook delivery.

## Email Delivery
Email delivery is handled via SMTP using `nodemailer`. 

### Configuration
All configuration is managed via environment variables:
- `SMTP_HOST`: SMTP server address.
- `SMTP_PORT`: Port (default 587).
- `SMTP_USER`: Authentication user.
- `SMTP_PASS`: Authentication password.
- `SMTP_FROM`: Sender address.

### Templates
Templates are located in `notifications/templates/`. They support simple variable substitution using `{{ variable_name }}` syntax.

---

## Webhook Delivery
Webhooks allow tenants to receive real-time JSON notifications at a specified URL.

### Security (HMAC Signing)
To ensure that payloads originate from PrintPrice, every request is signed using HMAC SHA256 with a tenant-specific `webhook_secret`.

#### Signing Mechanism:
1. PrintPrice generates the JSON payload.
2. The payload is signed using the secret: `HMAC_SHA256(json_payload, secret)`.
3. The signature is sent in the `X-PrintPrice-Signature` header.

#### Verification Example (Node.js):
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
    const expectedHash = crypto.createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');
    
    return signature === `sha256=${expectedHash}`;
}
```

### Constraints
- **Method**: HTTP POST
- **Content-Type**: `application/json`
- **Timeout**: 5 seconds. If the endpoint doesn't respond within 5s, the delivery is marked as FAILED and queued for retry.
- **Retries**: Follows the platform's exponential backoff policy (1m, 5m, 30m, 6h).

### Payload Format
```json
{
  "event_type": "quota.100",
  "tenant_id": "tenant-123",
  "notification_id": "uuid-v4",
  "timestamp": "2026-03-07T12:00:00Z",
  "payload": {
    "usage_percent": 100,
    "plan_name": "Pro"
  }
}
```
