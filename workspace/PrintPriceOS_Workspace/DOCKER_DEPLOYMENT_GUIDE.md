# DOCKER_DEPLOYMENT_GUIDE (Hardened & Verified v2.3)

**Status**: 🟢 PRODUCTION OPERATIONAL
**Version**: v2.3 (Decoupled & Plesk-Compatible)
**Stack**: Docker Compose + Node.js 20
**Environment**: Plesk / Linux Canonical Root

---

## 🏗️ 1. Directory Structure (Canonical)

The project resides in `/opt/printprice-os/`. The OS infrastructure is decoupled from the frontend to ensure stability.

```text
/opt/printprice-os/
  ├── ppos-preflight-service/
  ├── ppos-preflight-worker/
  ├── ppos-preflight-engine/
  ├── ppos-shared-infra/
  ├── ppos-shared-contracts/
  └── docker-compose.preflight.yml  <-- Main Orchestrator
```

---

## 🔨 2. Deployment Sequence (The "Sealed" Method)

### A. Infrastructure Configuration
To avoid conflicts with Plesk's native MySQL/Redis, we use non-standard host ports:
- **MySQL**: Host `3310` -> Container `3306`
- **Redis**: Host `6380` -> Container `6379`

### B. Clean Start
If you experience "Conflict" or "DNS" errors, always use the **Full Purge** method:

```bash
cd /opt/printprice-os

# 1. Force removal of existing containers
docker rm -f ppos-mysql ppos-redis ppos-preflight-service ppos-preflight-worker ppos-preflight-engine

# 2. Launch the "Machinery"
docker compose -f docker-compose.preflight.yml up -d ppos-mysql ppos-redis ppos-preflight-service ppos-preflight-worker ppos-preflight-engine
```


### B-2. The "Nuclear" Clean-up (Cache & Image Purge)
If builds continue to fail due to stale cache or disk space issues, use this command to reset the Docker local environment. 

> [!WARNING]
> **Use with caution!** This will delete ALL unused images, stopped containers, orphan networks, and the build cache. You will need to re-download images and re-build from scratch.

```bash
# Performs a radical purge of all dangling/unused Docker system data
docker system prune -a --volumes --force
```

### C. Database Bootstrapping (First Time Only)
If the database is new or was wiped, you must import the schema:

```bash
# Import the certified bootstrap script
docker exec -i ppos-mysql mysql -u root -proot printprice_os < ./ppos-shared-infra/bootstrap-v2-certified.sql

# Restart services to apply schema
docker compose -f docker-compose.preflight.yml restart ppos-preflight-service ppos-preflight-worker
```

---

## 📡 3. Verification & Troubleshooting

### Health Checks
- **Logs**: `docker logs ppos-preflight-service --tail 30`
- **Output**: Look for `[CLEANUP] [DONE] Purged X jobs` and `Preflight active on port 8001`.

### Common Fixes
- **MySQL permissions**: If "Access Denied" appears for `ppos_user`:
  `docker exec -it ppos-mysql mysql -u root -proot printprice_os -e "GRANT ALL PRIVILEGES ON printprice_os.* TO 'ppos_user'@'%'; FLUSH PRIVILEGES;"`
- **DNS (EAI_AGAIN)**: If services can't reach Redis/MySQL, perform a `docker compose down` and then `up -d` to refresh the Docker network bridge.
- **Port Conflict (3306/6379)**: Ensure the `.yml` file uses `3310:3306` and `6380:6379`.
