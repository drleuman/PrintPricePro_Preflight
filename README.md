# PrintPrice Pro - Preflight App (V2 Decoupled)

**A product by Print Price Pro**  
**Author:** Dr. Leuman  
**Architecture:** PrintPrice OS V2 Powered (Decoupled)  
**Website:** [https://printprice.pro/](https://printprice.pro/)

## Overview

**PrintPrice Pro Preflight** is the next-generation PDF analysis and transformation platform. Formerly a monolith, it has been re-architected in **Phase 10** into a decoupled, high-performance application that leverages the **PrintPrice OS (PPOS)** as its core intelligence engine.

This application provides the frontend and the bridge service to interact with the Dockerized PPOS infrastructure, ensuring enterprise-grade scalability, observability, and security.

## Key Features

- **Advanced Preflight Analysis:** Powered by the PPOS Preflight Service.
- **PPOS Integration:** Real-time job status tracking via Temporal and Redis.
- **Enterprise Auth Overlay:** Multi-tenant awareness and JWT security.
- **Unified API Client:** Simplified communication with the PPOS Gateway.
- **PDF Transformations:** Professional-grade conversion (CMYK, Grayscale, Rebuild DPI) via the Ghostscript-powered PPOS Engine.

## Technologies Used

- **Frontend:** React 19 + Vite (Modern, fast, and type-safe).
- **Backend Bridge:** Node.js 22 + Express (PPOS Service Connector).
- **Security:** JWT-based Enterprise Auth with PPOS support.
- **Infrastructure:** PrintPrice OS V2 (Dockerized MySQL, Redis, Temporal, RabbitMQ).
- **Deployment:** PM2 for the application bridge, Docker for the OS core.

## Getting Started

### Prerequisites

- **PrintPrice OS V2** running in Docker (on your server or locally).
- **Node.js 22+**.

### Installation

1. Clone the repository:
   ```bash
   git clone -b release/v2.1.2-certified https://github.com/drleuman/PrintPricePro_Preflight.git
   cd PrintPricePro_Preflight
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file based on the local setup:
   ```env
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=mysql://ppos_user:ppos_pass@localhost:3307/printprice_os
   REDIS_URL=redis://localhost:6380
   PPOS_SERVICE_URL=https://api.printprice.pro
   ```

4. Build the Frontend:
   ```bash
   npm run build
   ```

5. Start the Application:
   ```bash
   npm start
   ```

## Production Deployment

This app is designed to be deployed alongside the PrintPrice OS. For detailed server setup instructions, refer to the [Production Walkthrough](docs/DEPLOYMENT.md).

---
*Certified by Antigravity Automation Framework — Phase 10 Intelligence Layer.*
