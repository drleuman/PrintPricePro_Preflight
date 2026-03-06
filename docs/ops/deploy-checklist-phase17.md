# 🚀 Production Deployment Checklist — PrintPrice Phase 17

This checklist ensures a safe and robust deployment of the new **Public API**, **Batch Processing**, and **Tenant Analytics** infrastructure.

## 1. Environment Variables (Critical)
Ensure these are set in your `.env` or Plesk/System Environment:

| Variable | Recommended Value | Purpose |
|---|---|---|
| `NODE_ENV` | `production` | Enable performance optimizations and security |
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` | Production MySQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Necessary for BullMQ (Jobs & Webhooks) |
| `PPP_MAX_UPLOAD_BYTES` | `524288000` (500MB) | Guard against massive payloads |
| `PPP_MAX_BATCH_FILES` | `100` | Safety limit for ZIP extraction |
| `GS_TIMEOUT` | `300000` (5m) | Prevent hung PDF processes |
| `AUTO_MIGRATE` | `1` | Auto-create/update MySQL tables on startup |

## 2. Database Preparation
If `AUTO_MIGRATE=1`, tables will be created automatically. 
**Verification Query:** Run `DESCRIBE tenants; DESCRIBE webhooks;` to ensure `rate_limit_rpm` and `secret_key` columns exist.

## 3. Webhook Infrastructure
- [ ] **Worker Check:** Ensure `pm2 start server.js` is running (it now starts 3 workers: v2, batch, and webhook).
- [ ] **Secret Management:** Advise tenants to set a `secret_key` for HMAC verification (`X-PPP-Signature`).

## 4. API Key Management
Use the CLI to create your first production keys:
```bash
node scripts/api-keys.js create --tenant <customer_id> --name "Production Key" --plan PRO
```

## 5. Deployment Steps (Plesk/Ubuntu)
1. **Pull latest master:** `git pull origin master`
2. **Install dependencies:** `npm install --production`
3. **Build Frontend:** `npm run build`
4. **Restart Services:** `pm2 restart all` (or `pm2 restart ppp-server`)
5. **Check Logs:** `pm2 logs` (Look for `[SERVER-START] OK` and `[DB] Schema initialized`)

## 6. Smoke Tests (Post-Deploy)
Perform these tests using `curl` or Postman:
- [ ] **Auth:** `GET /api/v2/jobs` with a valid key (should be 200 OK).
- [ ] **Rate Limit:** hit `/api/v2/analytics/summary` repeatedly (should get 429 after limit).
- [ ] **Analytics:** `GET /api/v2/analytics/summary` (verify ROI metrics are present).
- [ ] **Batch:** `POST /api/v2/batches` with a small ZIP.
- [ ] **404 Check:** `GET /api/v2/non-existent` (should return JSON `{ "error": "Endpoint not found" }`).

## 7. Monitoring
- Monitor **PM2 logs** for `[WEBHOOK-WORKER]` failures (indicating invalid listener URLs).
- Check `audit_logs` table for API usage patterns.
