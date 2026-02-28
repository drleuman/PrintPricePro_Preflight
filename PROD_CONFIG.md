# Production Configuration Guide (Nginx / Proxy)

To resolve **502 Bad Gateway** errors and **PDF.js Worker MIME type** issues in production, apply the following configurations to your reverse proxy (Nginx/Plesk).

## 1. Fix PDF.js Worker MIME Type (CRITICAL)
Nginx often serves assets directly from `/assets/`. If `.mjs` is served as `application/octet-stream`, the worker fails.

**Replace your `/assets/` block in Plesk with this (or add it if missing):**
```nginx
# --- Static assets (Vite) including .mjs fix ---
location ^~ /assets/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    
    # Force correct MIME for .mjs ES module workers
    types { application/javascript  js mjs; }
    default_type application/javascript;

    try_files $uri =404;
}
```

---

## 2. Fix 502 Bad Gateway (Timeouts)
Ghostscript can take several minutes for heavy PDFs.

**Add these inside your `location /api/` block:**
```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8080;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # Increase timeouts for long-running PDF processing
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
  proxy_connect_timeout 30s;
  send_timeout 300s;

  # Disable buffering for large PDF streams
  proxy_buffering off;
  proxy_request_buffering off;

  client_max_body_size 512m;
}
```

---

## 3. Verify Routing & Health
The API now supports both prefixed and root health checks.

**Test via curl:**
```bash
# 1. MIME check (Expect: application/javascript)
curl -I https://preflight.printprice.pro/assets/pdf.worker.min-yatZIOMy.mjs

# 2. API Readiness (Expect: 200 OK)
curl -i https://preflight.printprice.pro/api/ready
curl -i https://preflight.printprice.pro/ready

# 3. Health check (Expect: 200 OK)
curl -i https://preflight.printprice.pro/api/healthz
```

## 4. Applying in Plesk
1. Go to **Apache & Nginx Settings**.
2. Add the snippets to **Additional nginx directives**.
3. Click OK to reload Nginx.
