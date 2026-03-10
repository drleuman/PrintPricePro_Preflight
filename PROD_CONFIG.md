# Production Configuration Guide (Nginx / Plesk)

To resolve **502 Bad Gateway**, **404 in Admin/SPA**, and **PDF.js Worker MIME type** issues, apply the following configuration into your Plesk **"Additional nginx directives"** box.

## Optimized Nginx Config (v2.1 - Consolidated)

```nginx
# =========================================================
# PrintPrice Preflight - Optimized Nginx Config (v2.1)
# =========================================================

# 1. MIME Fix para PDF.js worker
location ~* ^/assets/.*\.mjs$ {
    default_type application/javascript;
    add_header Content-Type application/javascript always;
    try_files $uri =404;
}

# 2. Caché de assets estáticos
location ^~ /assets/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    try_files $uri =404;
}

# 3. Endpoints de Diagnóstico
location = /ready {
    proxy_read_timeout 600s;
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

location = /healthz {
    proxy_read_timeout 600s;
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

# 4. API Reverse Proxy
location /api/ {
    proxy_read_timeout     600s;
    proxy_connect_timeout  60s;
    proxy_send_timeout     600s;
    client_body_timeout    600s;
    client_max_body_size   500M;

    proxy_request_buffering off;
    proxy_buffering off;
    proxy_intercept_errors off;

    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;
    proxy_set_header X-Accel-Buffering no;
}

# 5. Websocket Upgrade (Gemini Proxy)
location ^~ /api/gemini-proxy/ {
    proxy_read_timeout 600s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 600s;

    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Request-Id $request_id;
}

# 6. SPA Fallback (Admin & Frontend Routing)
# CRÍTICO: Este bloque debe ir al FINAL. 
# Captura todas las rutas que no son API ni assets (como /admin) y las pasa a Node.
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Opcional: mismos timeouts que la API para consistencia
    proxy_read_timeout 600s;
}
```

---

## Verification
1. Go to **Apache & Nginx Settings** in Plesk.
2. Replace your current directives with the **v2.1 block** above.
3. Click OK.
4. Test: `https://preflight.printprice.pro/admin` should now load the dashboard.
