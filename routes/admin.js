// routes/admin.js
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const db = require("../services/db");

const router = express.Router();

router.use(requireAdmin);

function rangeToInterval(range) {
  // soporta: 24h, 7d, 30d
  switch (range) {
    case "24h": return "INTERVAL 1 DAY";
    case "7d": return "INTERVAL 7 DAY";
    case "30d": return "INTERVAL 30 DAY";
    default: return "INTERVAL 1 DAY";
  }
}

// GET /api/admin/metrics/overview?range=24h
router.get("/metrics/overview", async (req, res) => {
  const interval = rangeToInterval(req.query.range);

  try {
    const { rows: [overview] } = await db.query(
      `
      SELECT 
        COUNT(*) as total_jobs,
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100 as success_rate,
        AVG(processing_ms) as avg_latency_ms,
        MAX(processing_ms) as max_latency_ms,
        (SUM(processing_ms) / 1000) as cost_proxy_seconds,
        SUM(value_generated) as total_value_generated,
        SUM(hours_saved) as total_hours_saved,
        AVG(risk_score_before) as avg_risk_before,
        AVG(risk_score_after) as avg_risk_after
      FROM metrics
      WHERE created_at >= NOW() - ${interval};
      `
    );

    const { rows: [improve] } = await db.query(
      `
      SELECT 
        ((SUM(CASE WHEN delta_score > 0 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100) as improvement_rate
      FROM metrics
      WHERE success = 1
        AND created_at >= NOW() - ${interval};
      `
    );

    const { rows: [queueStats] } = await db.query(
      `
      SELECT 
        SUM(CASE WHEN status IN ('QUEUED', 'RUNNING', 'FAILED') THEN 1 ELSE 0 END) as backlog,
        COALESCE(TIMESTAMPDIFF(SECOND, MIN(CASE WHEN status = 'QUEUED' THEN created_at ELSE NULL END), NOW()), 0) as oldest_age_seconds
      FROM jobs;
      `
    );

    res.json({
      totalJobs: Number(overview.total_jobs || 0),
      successRate: Number(overview.success_rate || 0),
      avgLatencyMs: Math.round(Number(overview.avg_latency_ms || 0)),
      maxLatencyMs: Math.round(Number(overview.max_latency_ms || 0)),
      p95LatencyMs: null,
      deltaImprovementRate: Number(improve.improvement_rate || 0),
      costProxy: Number(overview.cost_proxy_seconds || 0),
      totalValueGenerated: Number(overview.total_value_generated || 0),
      totalHoursSaved: Number(overview.total_hours_saved || 0),
      avgRiskBefore: Number(overview.avg_risk_before || 0),
      avgRiskAfter: Number(overview.avg_risk_after || 0),
      queueBacklog: Number(queueStats?.backlog || 0),
      oldestAgeSeconds: Number(queueStats?.oldest_age_seconds || 0)
    });
  } catch (err) {
    console.error('[ADMIN-API] Error fetching overview metrics:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/metrics/tenants?range=7d
router.get("/metrics/tenants", async (req, res) => {
  const interval = rangeToInterval(req.query.range || "7d");

  try {
    const { rows } = await db.query(
      `
      SELECT 
        tenant_id,
        COUNT(*) as total_jobs,
        (SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100 as success_rate,
        AVG(processing_ms) as avg_latency_ms,
        SUM(value_generated) as total_value_generated,
        SUM(hours_saved) as total_hours_saved,
        MAX(created_at) as last_activity
      FROM metrics
      WHERE created_at >= NOW() - ${interval}
      GROUP BY tenant_id
      ORDER BY total_jobs DESC;
      `
    );

    res.json(rows.map(r => ({
      tenant_id: r.tenant_id,
      totalJobs: Number(r.total_jobs || 0),
      successRate: Number(r.success_rate || 0),
      avgLatencyMs: Math.round(Number(r.avg_latency_ms || 0)),
      totalValueGenerated: Number(r.total_value_generated || 0),
      totalHoursSaved: Number(r.total_hours_saved || 0),
      topPolicy: null,
      lastActivity: r.last_activity
    })));
  } catch (err) {
    console.error('[ADMIN-API] Error fetching tenant metrics:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/jobs?status=FAILED&tenant=...&limit=50&offset=0
router.get("/jobs", async (req, res) => {
  const status = req.query.status || null;
  const tenant = req.query.tenant || null;
  const type = req.query.type || null;
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const offset = Math.max(Number(req.query.offset || 0), 0);

  const where = [];
  const params = [];

  if (status) { where.push("status = ?"); params.push(status); }
  if (tenant) { where.push("tenant_id = ?"); params.push(tenant); }
  if (type) { where.push("type = ?"); params.push(type); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows: [countRow] } = await db.query(
      `SELECT COUNT(*) as total FROM jobs ${whereSql};`,
      params
    );

    const { rows } = await db.query(
      `
      SELECT id, tenant_id, type, status, progress, error, created_at, updated_at
      FROM jobs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?;
      `,
      [...params, limit, offset]
    );

    res.json({
      total: Number(countRow?.[0]?.total || countRow?.total || 0), // Handle different mysql array returns
      jobs: rows.map(j => ({
        ...j,
        error: j.error ? j.error : null
      }))
    });
  } catch (err) {
    console.error('[ADMIN-API] Error fetching jobs:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/errors/top?range=24h
router.get("/errors/top", async (req, res) => {
  const interval = rangeToInterval(req.query.range || "7d");

  try {
    const { rows } = await db.query(
      `
  SELECT
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(error, '$.code')), 'UNKNOWN') as error_code,
    COUNT(*) as error_count,
    MAX(updated_at) as last_seen
  FROM jobs
  WHERE status = 'FAILED'
    AND created_at >= NOW() - ${interval}
    AND error IS NOT NULL
  GROUP BY error_code
  ORDER BY error_count DESC
  LIMIT 10;
  `
    );

    res.json(rows.map(r => ({
      errorCode: r.error_code || "UNKNOWN",
      count: Number(r.error_count || 0),
      lastSeen: r.last_seen
    })));
  } catch (err) {
    console.error('[ADMIN-API] Error fetching top errors:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/audit?tenant_id=...&limit=100
router.get("/audit", async (req, res) => {
  const tenant = req.query.tenant_id || null;
  const jobId = req.query.job_id || null;
  const limit = Math.min(Number(req.query.limit || 100), 500);

  const where = [];
  const params = [];

  if (tenant) { where.push("tenant_id = ?"); params.push(tenant); }
  if (jobId) { where.push("job_id = ?"); params.push(jobId); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows } = await db.query(
      `
      SELECT id, job_id, tenant_id, action, policy_slug, ip_address, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ?;
      `,
      [...params, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('[ADMIN-API] Error fetching audit logs:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/queue  (stats BullMQ)
router.get("/queue", async (_req, res) => {
  try {
    const queue = require("../services/queue");
    if (queue && queue.getAdminStats) {
      const stats = await queue.getAdminStats();
      res.json(stats);
    } else {
      res.json({ ok: true, note: "queue stats not implemented in queue.js" });
    }
  } catch (err) {
    res.json({ ok: true, note: "queue stats not available", error: err.message });
  }
});

// POST /api/admin/help/analytics
router.post("/help/analytics", async (req, res) => {
  const { event_type, article_id, search_query, tenant_id, user_id } = req.body;

  if (!event_type) {
    return res.status(400).json({ ok: false, error: "event_type is required" });
  }

  try {
    const { rows } = await db.query(
      `
      INSERT INTO audit_help_analytics (event_type, article_id, search_query, tenant_id, user_id)
      VALUES (?, ?, ?, ?, ?)
      `,
      [event_type, article_id || null, search_query || null, tenant_id || null, user_id || null]
    );

    res.json({ ok: true, id: rows.insertId });
  } catch (err) {
    console.error('[ADMIN-API] Error saving help analytics:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
