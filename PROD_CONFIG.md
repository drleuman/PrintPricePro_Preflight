# Production Configuration Guide (Nginx / Plesk)

To resolve **502 Bad Gateway**, **PDF.js Worker MIME type**, and **streaming timeout** issues, apply the following configuration into your Plesk **"Additional nginx directives"** box.

## Optimized Nginx Config (v2.0)

```nginx
# =========================================================
# PrintPrice Preflight - Optimized Nginx Config (v2.0)
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

# 3. Endpoints de Diagnóstico (vía Node)
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

# 4. API Reverse Proxy (DISEÑO INDUSTRIAL)
location /api/ {
    proxy_read_timeout     600s;
    proxy_connect_timeout  60s;
    proxy_send_timeout     600s;

    # NUEVO: Evita timeout DURANTE la subida del archivo
    client_body_timeout    600s;

    # AJUSTADO: Aumentado a 500MB para PDFs pesados
    client_max_body_size   500M;

    # CRÍTICO: Streaming directo para evitar 502 y lag
    proxy_request_buffering off;
    proxy_buffering off;

    # Evita que Nginx intercepte errores de Node
    proxy_intercept_errors off;

    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Request-Id $request_id;

    # Asegura que el streaming no se bufferiza
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

    # Protocol Upgrade
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Request-Id $request_id;
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
