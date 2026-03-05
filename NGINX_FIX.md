# Guía de Reparación de Nginx (Producción)

Para solucionar los errores **502 Bad Gateway** y los problemas de **MIME type** en tu servidor, sigue estos pasos. Los archivos `.mjs` deben servirse como `application/javascript` y las peticiones pesadas necesitan más tiempo para procesarse.

## 1. Corregir Tipos MIME (.mjs)

Edita el archivo de tipos MIME global (usualmente en `/etc/nginx/mime.types`) o añade esta línea en el bloque `http` de tu archivo `/etc/nginx/nginx.conf`:

```nginx
types {
    application/javascript mjs;
}
```

*Si no quieres tocar el archivo global, puedes añadirlo dentro del bloque `server` de tu sitio.*

## 2. Aumentar Timeouts y Límites de Subida

Edita el archivo de configuración de tu sitio (ej. `/etc/nginx/sites-available/preflight.printprice.pro`) y asegúrate de que el bloque `location /` (o el que haga el proxy al puerto 8080) tenga estos valores:

```nginx
location / {
    proxy_pass http://localhost:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # --- CONFIGURACIÓN CRÍTICA PARA PDF ---
    client_max_body_size 500M;      # Permitir subida de PDFs de hasta 500MB
    proxy_connect_timeout 600s;     # Tiempo de conexión
    proxy_send_timeout 600s;        # Tiempo de envío
    proxy_read_timeout 600s;        # Tiempo de espera de respuesta (Evita el 502)
    send_timeout 600s;              # Tiempo de respuesta del cliente
}
```

## 3. Reiniciar Nginx

Una vez realizados los cambios, verifica la sintaxis y reinicia el servicio:

```bash
nginx -t
systemctl restart nginx
```

---

### ¿Por qué esto es necesario?
1. **MIME Type**: Los navegadores modernos bloquean los "Strict MIME type checking" para módulos Javascript si el servidor responde con `application/octet-stream`.
2. **502 Bad Gateway**: Ghostscript puede tardar varios minutos en procesar PDFs grandes o generar vistas previas de muchas páginas. Si Nginx espera solo 60 segundos (valor por defecto), cortará la conexión y verás el error 502.
