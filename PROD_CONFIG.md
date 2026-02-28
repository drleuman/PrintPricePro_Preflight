# Production Configuration Guide (Nginx / Proxy)

To resolve **502 Bad Gateway** errors and **PDF.js Worker MIME type** issues in production, apply the following configurations to your reverse proxy (Nginx/Plesk).

## 1. Fix 502 Bad Gateway (Timeouts)
Ghostscript can take over 60 seconds to process high-resolution or multi-page PDFs. The default Nginx timeout is often too low.

**Add these lines to your Nginx `server` block (or `location /api/` block):**

```nginx
# Increase timeouts for long-running PDF processing
proxy_read_timeout 300s;
proxy_send_timeout 300s;
proxy_connect_timeout 75s;
send_timeout 300s;

# Disable buffering for large PDF streams
proxy_buffering off;
proxy_request_buffering off;

# Increase max upload size (e.g., 512MB)
client_max_body_size 512m;
```

## 2. Fix PDF.js Worker MIME Type
The browser rejects `.mjs` files if served with `application/octet-stream`. We must ensure they are served as `application/javascript`.

**Update the `http` or `server` block in Nginx:**

```nginx
types {
    application/javascript js mjs;
    text/css css;
}

# OR specifically for the assets folder:
location /assets/ {
    root /path/to/your/dist;
    include mime.types;
    types {
        application/javascript mjs;
    }
}
```

## 3. Verify Configurations
After applying changes, reload Nginx:
```bash
nginx -t
service nginx reload
```

**Test with curl:**
```bash
# Check MIME type
curl -I https://preflight.printprice.pro/assets/pdf.worker.min-*.mjs

# Check API health
curl -i https://preflight.printprice.pro/ready
```
