Deployment and Environment Configuration

This repository ships a small Node.js + Ghostscript service for PDF preflight checks.

Important environment variables

- PPP_API_KEY: (recommended) a secret API key that protects heavy server endpoints. When set, protected endpoints require the key via one of:
  - HTTP header: x-ppp-api-key: <your-key>
  - Query param: ?api_key=<your-key>
  - Form/body field: api_key=<your-key>
  - Note: the middleware bypasses the check when NODE_ENV=development or when PPP_API_KEY is unset.

  Example (Linux/macOS):

  ```bash
  export PPP_API_KEY="s3cr3t-token"
  ```

- PPP_UPLOAD_DIR: optional path for uploaded files (defaults to OS temp dir). Use when the container runtime requires a specific writable path.
- PPP_MAX_INMEMORY_PDF_BYTES: (default 209715200) maximum PDF size in bytes allowed for in-memory processing (~200MB).
- PPP_WORKER_MAX_OLD_SPACE_MB: (default 256) V8 --max-old-space-size for the isolated PDF probe worker.
- PPP_ALLOWED_ORIGINS: comma-separated list of origins allowed by CORS in production.
- PPP_RATE_LIMIT_WINDOW_MS / PPP_RATE_LIMIT_MAX: window and max requests for rate-limiting heavy endpoints.
- PPP_SHA_TIMEOUT_MS: timeout for streaming SHA256 calculation for large uploads (milliseconds).
- PPP_CLEANUP_MAX_AGE_MS / PPP_CLEANUP_INTERVAL_MS: controls background cleanup behaviour.

Quick local test

Run the probe worker test locally to validate basic PDF parsing works:

```bash
npm run test:probe
```

Deployment checklist and recommendation

- Already implemented in this branch:
  - Relaxed upload mimetype checks with PDF signature validation.
  - Worker isolation for heavy PDF parsing (`server/workers/pdf_probe.js`).
  - Replaced blocking sync I/O in key paths with async/streaming approaches.
  - Capped subprocess output capture and added background cleanup safety.
  - Added a CI workflow to run the probe test on PRs.

- Recommended before production deploy:
  1. Set `PPP_API_KEY` and validate protected endpoints from staging.
  2. Configure `PPP_ALLOWED_ORIGINS` and Content Security Policy for your domain.
  3. Ensure Ghostscript is installed on target hosts or included in your container image.
  4. Add application monitoring (logs, error tracking) and alerts for OOM or heavy worker failures.
  5. Run load tests and spike tests against staging to validate worker memory caps and rate limits.
  6. Optionally add stronger auth (OIDC/API gateway) if the service will be publicly accessible.

Recommendation: Deploy to staging now (with `PPP_API_KEY` set, Ghostscript available, and monitoring enabled). Do not promote to production until you validate load tests, monitoring, and access controls.

Example curl commands

- Health and readiness checks:

```bash
curl -v http://localhost:8080/healthz
curl -v http://localhost:8080/ready
```

- Call protected endpoint (replace <KEY> and file):

```bash
curl -X POST -H "x-ppp-api-key: <KEY>" -F "file=@./sample.pdf" http://localhost:8080/api/convert/grayscale
```

- Trigger autofix (multipart form):

```bash
curl -X POST -H "x-ppp-api-key: <KEY>" -F "file=@./sample.pdf" -F "profile=iso_coated_v3" http://localhost:8080/api/convert/autofix
```
