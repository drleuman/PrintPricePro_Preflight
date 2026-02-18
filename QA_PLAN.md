# Job Queue QA Plan

This plan verifies the robust processing of large PDFs using the newly implemented PostgreSQL-backed job queue.

## 1. Environment Setup
- Ensure PostgreSQL is running and accessible via `DATABASE_URL` in `.env`.
- Run `npm run init-db` (or `node scripts/init_db.js`) to create tables.
- Start the server: `npm start`.
- Start the worker in a separate terminal: `npm run worker`.

## 2. Test Scenarios

### Scenario A: Small PDF (Standard Path)
- Upload a < 80MB PDF.
- **Expectation**: Processed synchronously as before (Normal Mode). UI should be immediate.

### Scenario B: Large PDF (Queue Path)
- Upload a > 150 page document or > 80MB file.
- **Expectation**: 
  - Server responds immediately with `jobId` and `status: QUEUED`.
  - UI shows the Large Document Mode banner with progress bar.
  - Worker picks up `SPLIT` task.
  - Worker executes `PAGE_PROCESS` for each page sequentially.
  - Progress updates in real-time on UI via polling.
  - Document merges and status becomes `CERTIFIED`.
  - UI triggers final download and re-analysis.

### Scenario C: Concurrent Jobs
- Upload two large PDFs simultaneously.
- **Expectation**:
  - Both jobs enqueued.
  - Worker processes tasks one-by-one (or according to `MAX_WORKERS`).
  - System remains responsive; no CPU/RAM spikes above limits.

### Scenario D: Cancellation
- Start a large job and click "Cancel" (if UI allows) or send `POST /api/convert/job/cancel/:id`.
- **Expectation**:
  - `jobs.status` becomes `CANCELED`.
  - Pending tasks are skipped.
  - Worker stops processing the job after the current task finishes.

### Scenario E: Retry Mechanism
- Simulate a failure (e.g., kill Ghostscript during a task).
- **Expectation**:
  - Task becomes `RETRY_WAIT`.
  - Worker retries up to 3 times with exponential backoff.
  - Job eventually succeeds or moves to `FAILED` if unrecoverable.

## 3. Resource Monitoring
- Monitor RAM usage. It should not exceed ~700MB even for very large files.
- Monitor Disk space in `/jobs/`. Ensure it cleans up or respects quotas.
