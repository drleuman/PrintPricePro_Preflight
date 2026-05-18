# PrintPrice Pro — Preflight App (V2 Decoupled)

<p align="center">
  <img src="frontend/favicon.svg" alt="PrintPrice Pro Logo" width="80" height="80" />
</p>

**Una plataforma de inteligencia de producción por Print Price Pro**  
**Autor:** Dr. Leuman & Manuel Enrique Morales  
**Arquitectura:** Decoupled Intelligence Layer (Phase 10)  
**Estado del Sistema:** 🟢 CERTIFICADO & AUDITADO (100% de Pruebas Exitosas)  
**Sitio Web:** [https://printprice.pro/](https://printprice.pro/)

---

## 📄 Resumen General

**PrintPrice Pro Preflight** es la plataforma de análisis forense y transformación curativa de archivos PDF de próxima generación. Diseñada bajo un esquema desacoplado y de alto rendimiento, actúa como la capa BFF (Backend-for-Frontend) y el cliente visual inteligente que interactúa directamente con el núcleo operativo dockerizado de **PrintPrice OS (PPOS)** a través de colas distribuidas (Temporal, RabbitMQ) y motores analíticos de vanguardia.

El sistema garantiza una gobernanza estricta, un entorno de trabajo hermético con aislamiento multi-inquilino (*multi-tenant*) y capacidades avanzadas de autocorrección auto-sanadora (*self-healing AI Autofix*) para flujos de trabajo de imprenta industrial y edición digital.

---

## 🛠️ Características Principales y Flujo Operativo

La aplicación web ofrece un flujo de trabajo optimizado en 5 etapas secuenciales de alta fidelidad:

### 1. Ingress (Carga y Selección de Directiva)
* Zona de arrastrar y soltar optimizada (`PreflightDropzone`).
* Selección dinámica de políticas de validación (ej. *Offset Modern Coated*, etc.) que dictan los umbrales de severidad del motor.
* Configuración del modo operativo del sistema: **Modo Escáner Forense (Manual)**, **Modo Auto-Corrección Pro (AI)** o **Modo Auditoría de Eficiencia (Audit)**.

### 2. Forensics (Análisis de Errores)
* Escaneo exhaustivo en paralelo de incidencias en categorías clave (Imágenes, Espacios de Color, Fuentes, Metadatos, Sangrado y Margen, Transparencias, Geometría, etc.).
* Medidor interactivo de nivel de riesgo técnico (`RiskMeter`) que clasifica los problemas en Críticos (Errors), Advertencias (Warnings) e Info.
* Sugerencias de remediación estructuradas, explicando la regla incumplida y la recomendación técnica.

### 3. Engine (Centro de Remedios y Edición)
* **AI AutoFix Pro:** Tubería auto-sanadora y de corrección automática en segundo plano (v2.4.120) que repara sangrados, redefine trimboxes y soluciona problemas de fuentes sin re-subir el archivo original.
* **Herramientas Manuales:** Conversión de color inteligente a CMYK bajo perfiles de color seleccionados (ej. FOGRA51/FOGRA39), paso a escala de grises, reconstrucción forense de resolución a 300 DPI y Booklet (imposición client-side).
* **TAC Heatmap:** Analizador integrado de Cobertura Total de Área (*Total Area Coverage*) ejecutado mediante Web Workers independientes para diagnosticar oportunidades de ahorro de tinta.

### 4. Certify (Gobernanza y QA Visual)
* Comparador de documentos interactivo antes/después (`PdfComparisonViewer`) con previsualización página por página.
* Validación forense de correcciones aplicadas y diagnóstico de fallos de fijación.
* Visualización de fichas y notas técnicas de certificación de PPOS.

### 5. Download (Descarga del Producto Certified)
* Transmisión de descarga autenticada robusta y directa desde el BFF hacia el navegador, garantizando que el token de seguridad no caduque en archivos de gran tamaño.
* Exportación y descarga del PDF certificado listo para producción e informe estructurado de Preflight en formato JSON.

---

## ⚙️ Arquitectura Interna y Seguridad (BFF & Backend)

* **Bootstrap Diagnostic Integrado:** El servidor Express realiza un chequeo dinámico de salud en su arranque, comprobando dependencias físicas (Ghostscript, etc.), latencia del motor, y la conectividad con MySQL/Redis.
* **Aislamiento Multi-Tenant de Hilo Seguro:** Implementado mediante `AsyncLocalStorage` en [TenantContext.js](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/app/services/TenantContext.js) y validado a través de [enterpriseAuth.js](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/app/middleware/enterpriseAuth.js). Asegura que los límites de planes, cuotas de trabajos diarios y alcances (*scopes*) estén rigurosamente restringidos a cada inquilino.
* **Control de Idempotencia en Autofix:** Un semáforo de bloqueo activo en el BFF (`autofixIdempotencyMap`) deduplica llamadas concurrentes a reparaciones duplicadas, optimizando el consumo del motor y liberando la memoria en caso de error upstream.
* **Desinfección de logs (Worker Guardrails):** La lógica de [workerSanitizer.js](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/app/services/workerSanitizer.js) enmascara y censura automáticamente rutas de archivos locales (Windows y Unix) y fragmentos sensibles antes de que alcancen bases de datos o consolas públicas.

---

## 🚀 Puesta en Marcha

### Requisitos Previos
* **Node.js v22+** (Entorno de ejecución LTS Recomendado).
* **MySQL 8.0+** (Base de datos relacional para identidades y gobierno).
* **PrintPrice OS V2** activo y accesible en la red.

### Instalación de Dependencias
1. Clonar el repositorio y acceder a él:
   ```bash
   git clone -b release/v2.1.2-certified https://github.com/drleuman/PrintPricePro_Preflight.git
   cd PrintPricePro_Preflight
   ```
2. Instalar los módulos del proyecto:
   ```bash
   npm install
   ```

### Configuración del Entorno (`.env`)
Crea un archivo `.env` en la raíz del proyecto configurando tus credenciales de base de datos MySQL y la URL del servicio PPOS:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mysql://usuario:contraseña@localhost:3306/printprice_os
PPOS_SERVICE_URL=https://api.printprice.pro
PPOS_PREFLIGHT_SERVICE_URL=http://localhost:8001
JWT_SECRET=tu_secreto_super_seguro
AUTO_MIGRATE=1
```

### Inicialización y Sembrado de Base de Datos
Si `AUTO_MIGRATE=1` está definido, las tablas se crearán y sincronizarán automáticamente al arrancar el servidor en [dbSchema.js](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/app/services/dbSchema.js). Si la tabla de usuarios está vacía, se sembrarán 3 cuentas iniciales de prueba de forma automática:
* `author@printprice.pro` (Plan FREE)
* `publisher@printprice.pro` (Plan PRO, AI Magic Fix Activo)
* `admin@printprice.pro` (Desarrollador, AI Magic Fix Activo)
* *Contraseña por defecto para todas las cuentas sembradas:* `password123`

---

## 📈 Scripts Disponibles

* `npm run dev`: Inicia el servidor de desarrollo Vite para el Frontend en el puerto 3000 (con proxy inverso a la API en el puerto 8080).
* `npm run build`: Compila el frontend estático React 19 / TypeScript en la carpeta `frontend/dist`.
* `npm start`: Inicia el BFF Express en producción en el puerto configurado (servirá también los archivos compilados de React de forma transparente).
* `npm test`: Ejecuta el suite de pruebas unitarias.

### Aislamiento de Compilación (Solución de PostCSS Traversal)
Si al compilar con `npm run build` experimentas un error relacionado con la carga de módulos globales como:
`Error: Loading PostCSS Plugin failed: Cannot find module 'tailwindcss'`  
Esto se debe a que PostCSS encuentra una configuración global en la raíz del perfil de usuario de tu sistema local (ej. `C:\Users\tu-usuario\postcss.config.js`). El proyecto previene este problema proactivamente al contar con un archivo [postcss.config.js](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/frontend/postcss.config.js) local en la carpeta del frontend, asegurando una compilación aislada e independiente.

---

## 📊 Auditoría del Sistema

Hemos elaborado una auditoría completa del sistema abarcando pruebas dinámicas, seguridad multi-inquilino, mitigación de fugas y resiliencia de compilación.

Para ver el reporte técnico completo y los planes de mitigación de ingeniería sugeridos, consulta el documento principal de la auditoría:  
👉 **[Reporte de Auditoría de Sistemas](file:///c:/Users/KIKE/Desktop/Preflight/PrintPricePro_Preflight/AUDIT_REPORT.md)**

* **Resumen de Tareas Realizadas:**
  * 🟢 **90 de 90 Pruebas Unitarias** ejecutadas y validadas con 100% de aprobación.
  * 🟢 Compilación estática blindada y completada con éxito.
  * 🟢 Mitigación activa certificada de fugas de rutas en logs de trabajadores.

---
*Certificado bajo el marco automatizado de aseguramiento de calidad Antigravity — Phase 10 Intelligence Layer.*
