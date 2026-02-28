# Production Configuration Guide (Nginx / Plesk)

To resolve **502 Bad Gateway**, **PDF.js Worker MIME type**, and **streaming timeout** issues, apply the following configuration to your reverse proxy (Nginx/Plesk).

> Add all blocks to **"Additional nginx directives"** in Plesk **Apache & Nginx Settings**.

## 0. WebSocket Upgrade Map (add once, at the top)
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

## 1. Fix PDF.js Worker MIME Type (CRITICAL)
Nginx often serves assets directly. If `.mjs` is served as `application/octet-stream`, the worker fails.

**A) Surgical Fix (Add to Plesk "Additional nginx directives"):**
```nginx
location ~* ^/assets/.*\.mjs$ {
    default_type application/javascript;
    add_header Content-Type application/javascript always;
    try_files $uri =404;
}
```

**B) Global Fix (Recommended for SysAdmins):**
Add `mjs` to your global `/etc/nginx/mime.types` file:
```nginx
application/javascript js mjs;
```

---

## 2. Fix Readiness Endpoint & 502 Timeouts
Ensure the diagnostics endpoint is reachable and Nginx doesn't timeout during heavy PDF processing.

**Add these to Plesk "Additional nginx directives":**
```nginx
# Handle the /ready endpoint explicitly
location = /ready {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Configure /api/ with extended timeouts
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Timeouts for Ghostscript (up to 5 mins)
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
    proxy_connect_timeout 30s;
    send_timeout 300s;

    # Disable buffering for large streams
    proxy_buffering off;
    proxy_request_buffering off;

    client_max_body_size 512m;
}
```

---

## 3. Verify Configurations
After applying changes and reloading Nginx, verify with these commands:

```bash
# 1. Verify Worker MIME Type (Expect: application/javascript)
curl -I https://preflight.printprice.pro/assets/pdf.worker.min-yatZIOMy.mjs

# 2. Verify Diagnostic Endpoints (Expect: 200 OK + JSON)
curl -i https://preflight.printprice.pro/ready
curl -i https://preflight.printprice.pro/api/ready
```

## 4. Applying in Plesk
1. Go to **Apache & Nginx Settings** for the domain.
2. Add the snippets above to the **Additional nginx directives** textarea.
3. Ensure "Proxy mode" is **ON**.
4. Click OK/Apply.
