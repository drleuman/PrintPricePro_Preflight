// routes/admin.js
const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const db = require("../services/db");

const router = express.Router();
router.use(requireAdmin);

// Import sub-routers
const connectAdminRouter = require('./connectAdmin');
const routingAdminRouter = require('./routingAdmin');
const marketplaceAdminRouter = require('./marketplaceAdmin');
const economicRoutingAdminRouter = require('./economicRoutingAdmin');
const pricingAdminRouter = require('./pricingAdmin');
const offersAdminRouter = require('./offersAdmin');
const negotiationAdminRouter = require('./negotiationAdmin');
const commercialCommitmentAdminRouter = require('./commercialCommitmentAdmin');
const autonomyAdminRouter = require('./autonomyAdmin');
const autonomyFinanceRouter = require('./autonomyFinanceAdmin');
const adminControlRoutes = require('./adminControl');

router.use((req, res, next) => {
  console.log(`[DEBUG-ADMIN-ROUTER] Incoming: ${req.method} ${req.originalUrl} | BasePath: ${req.baseUrl} | Path: ${req.path}`);
  next();
});

// Test Trace Route
router.get('/test-trace', (req, res) => {
  res.json({
    ok: true,
    message: 'Admin Router Reachable',
    path: req.path,
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl
  });
});

/**
 * Mount Sub-routers (Top Priority)
 */
router.use('/network', connectAdminRouter);
router.use('/routing/economic', economicRoutingAdminRouter); // Important: more specific first
router.use('/routing', routingAdminRouter);
router.use('/marketplace/ready', negotiationAdminRouter); // Important: more specific first
router.use('/marketplace', marketplaceAdminRouter);
router.use('/pricing', pricingAdminRouter);
router.use('/offers', offersAdminRouter);
router.use('/commercial', commercialCommitmentAdminRouter);
router.use('/autonomy', autonomyAdminRouter);
router.use('/finance', autonomyFinanceRouter);
router.use('/control', adminControlRoutes);

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

// GET /api/admin/tenants - Detailed tenant list for management (Phase 19)
router.get("/tenants", async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        id, name, status, plan, rate_limit_rpm, 
        plan_expires_at, last_active_at, daily_job_limit, 
        max_batch_size, created_at, metadata_json
      FROM tenants
      ORDER BY last_active_at DESC, created_at DESC;
    `);

    // Fetch API Keys count per tenant
    const { rows: keyCounts } = await db.query(`
      SELECT tenant_id, COUNT(*) as key_count
      FROM api_keys
      WHERE revoked = FALSE
      GROUP BY tenant_id;
    `);

    // Fetch Daily Job Usage (Phase 19.5)
    const { rows: usageCounts } = await db.query(`
      SELECT tenant_id, COUNT(*) as daily_count
      FROM jobs
      WHERE created_at >= CURDATE()
      GROUP BY tenant_id;
    `);

    const keyMap = keyCounts.reduce((acc, current) => {
      acc[current.tenant_id] = current.key_count;
      return acc;
    }, {});

    const usageMap = usageCounts.reduce((acc, current) => {
      acc[current.tenant_id] = current.daily_count;
      return acc;
    }, {});

    res.json(rows.map(t => ({
      ...t,
      keyCount: keyMap[t.id] || 0,
      dailyUsage: usageMap[t.id] || 0
    })));
  } catch (err) {
    console.error('[ADMIN-API] Error fetching detailed tenants:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/tenants/:id - Update tenant settings (Phase 19)
// POST /api/admin/tenants/:id
router.post("/tenants/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    // 1. Get current state for history (Phase 20)
    const { rows: [current] } = await db.query('SELECT plan, status FROM tenants WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ ok: false, error: 'Tenant not found' });

    // 2. Perform Update
    const allowedFields = ['name', 'status', 'plan', 'rate_limit_rpm', 'plan_expires_at', 'daily_job_limit', 'max_batch_size', 'metadata_json', 'notification_settings_json'];
    const fieldsToUpdate = Object.keys(updates).filter(k => allowedFields.includes(k));

    if (fieldsToUpdate.length > 0) {
      const setClause = fieldsToUpdate.map(k => `${k} = ?`).join(', ');
      const values = fieldsToUpdate.map(k => {
        const val = updates[k];
        if (k === 'plan_expires_at' && !val) return null;
        if ((k === 'metadata_json' || k === 'notification_settings_json') && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });

      await db.query(`UPDATE tenants SET ${setClause} WHERE id = ?`, [...values, id]);
    }

    // 3. Log lifecycle events if plan or status changed
    if (updates.plan && updates.plan !== current.plan) {
      await db.query(`
        INSERT INTO tenant_plan_history (tenant_id, old_plan, new_plan, reason)
        VALUES (?, ?, ?, ?)
      `, [id, current.plan, updates.plan, 'Manual update via Admin Dashboard']);
    }

    if (updates.status && updates.status !== current.status) {
      await db.query(`
        INSERT INTO tenant_alerts_history (tenant_id, alert_type, details_json)
        VALUES (?, ?, ?)
      `, [id, 'STATUS_CHANGE', JSON.stringify({ old: current.status, new: updates.status })]);
    }

    res.json({ ok: true, message: `Tenant ${id} updated.` });
  } catch (err) {
    console.error('[ADMIN-API] Error updating tenant:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/tenants/:id/usage?days=7
router.get("/tenants/:id/usage", async (req, res) => {
  const { id } = req.params;
  const days = Math.min(Number(req.query.days || 7), 30);

  try {
    const { rows } = await db.query(`
      SELECT date, jobs_count, batches_count, value_generated, hours_saved
      FROM tenant_usage_stats
      WHERE tenant_id = ?
      ORDER BY date DESC
      LIMIT ?
    `, [id, days]);

    res.json(rows.reverse()); // Return in chronological order
  } catch (err) {
    console.error('[ADMIN-API] Error fetching tenant usage stats:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/tenants/:id/timeline
router.get("/tenants/:id/timeline", async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await db.query(`
      (SELECT 'ALERT' as type, alert_type as event, details_json as details, created_at as timestamp 
       FROM tenant_alerts_history WHERE tenant_id = ?)
      UNION ALL
      (SELECT 'PLAN' as type, CONCAT(old_plan, ' -> ', new_plan) as event, JSON_OBJECT('reason', reason) as details, changed_at as timestamp
       FROM tenant_plan_history WHERE tenant_id = ?)
      ORDER BY timestamp DESC
      LIMIT 100
    `, [id, id]);

    res.json(rows);
  } catch (err) {
    console.error('[ADMIN-API] Error fetching tenant timeline:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/tenants/:id/billing/:year/:month
// Support for range queries: ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Precedence: If ?from and ?to are present, they override :year and :month.
router.get("/tenants/:id/billing/:year/:month", async (req, res) => {
  const { id, year, month } = req.params;
  const { from, to } = req.query;

  try {
    let startDate, endDate;

    if (from && to) {
      startDate = from;
      endDate = to;
    } else {
      startDate = `${year}-${month.padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
    }

    // Prepend time to dates for precision
    const startTs = `${startDate} 00:00:00`;
    const nextDayDate = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endTsLimit = `${nextDayDate} 00:00:00`;

    const { rows: stats } = await db.query(`
      SELECT 
        SUM(jobs_count) as total_jobs,
        SUM(batches_count) as total_batches,
        SUM(value_generated) as total_value,
        SUM(hours_saved) as total_hours,
        MAX(jobs_count) as peak_daily_jobs,
        AVG(jobs_count) as avg_jobs_per_day,
        (SELECT date FROM tenant_usage_stats 
         WHERE tenant_id = ? AND date >= ? AND date < ?
         ORDER BY jobs_count DESC LIMIT 1) as peak_day,
        (SELECT SUM(risk_reduction) FROM tenant_usage_stats
         WHERE tenant_id = ? AND date >= ? AND date < ?) as total_risk_reduction
      FROM tenant_usage_stats
      WHERE tenant_id = ? AND date >= ? AND date < ?
    `, [id, startDate, nextDayDate, id, startDate, nextDayDate, id, startDate, nextDayDate]);

    // Enhanced metrics: Policy distribution (as object)
    const { rows: policies } = await db.query(`
      SELECT policy_slug, COUNT(*) as count
      FROM audit_logs
      WHERE tenant_id = ? AND created_at >= ? AND created_at < ?
        AND policy_slug IS NOT NULL
      GROUP BY policy_slug
      ORDER BY count DESC
    `, [id, startTs, endTsLimit]);

    const policyMap = policies.reduce((acc, curr) => {
      acc[curr.policy_slug] = curr.count;
      return acc;
    }, {});

    if (!stats[0] || stats[0].total_jobs === null) {
      return res.json({
        ok: true,
        period: from && to ? `${from} to ${to}` : `${year}-${month}`,
        usage: { total_jobs: 0, total_batches: 0, total_value: 0, total_hours: 0, total_risk_reduction: 0, avg_jobs_per_day: 0, policy_distribution: {} },
        message: "No usage data found for this period."
      });
    }

    res.json({
      ok: true,
      period: from && to ? `${from} to ${to}` : `${year}-${month}`,
      usage: {
        ...stats[0],
        policy_distribution: policyMap
      }
    });
  } catch (err) {
    console.error('[ADMIN-API] Error fetching billing data:', err);
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
      `SELECT COUNT(*) as total FROM jobs ${whereSql}; `,
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

  const whereSql = where.length ? `WHERE ${where.join(" AND ")} ` : "";

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
      INSERT INTO audit_help_analytics(event_type, article_id, search_query, tenant_id, user_id)
    VALUES(?, ?, ?, ?, ?)
      `,
      [event_type, article_id || null, search_query || null, tenant_id || null, user_id || null]
    );

    res.json({ ok: true, id: rows.insertId });
  } catch (err) {
    console.error('[ADMIN-API] Error saving help analytics:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PHASE 21.1: Notification Management
 */

// GET /api/admin/notifications
router.get("/notifications", async (req, res) => {
  const { tenant_id, status, event_type, channel, limit = 50, offset = 0 } = req.query;
  const where = [];
  const params = [];

  if (tenant_id) { where.push("tenant_id = ?"); params.push(tenant_id); }
  if (status) { where.push("status = ?"); params.push(status); }
  if (event_type) { where.push("event_type = ?"); params.push(event_type); }
  if (channel) { where.push("channel = ?"); params.push(channel); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  try {
    const { rows: notifications } = await db.query(`
      SELECT * FROM notifications 
      ${whereSql} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), Number(offset)]);

    const { rows: [count] } = await db.query(`SELECT COUNT(*) as total FROM notifications ${whereSql}`, params);

    res.json({
      ok: true,
      notifications,
      total: count.total
    });
  } catch (err) {
    console.error('[ADMIN-API] Error fetching notifications:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/notifications/:id
router.get("/notifications/:id", async (req, res) => {
  try {
    const { rows: [notification] } = await db.query("SELECT * FROM notifications WHERE id = ?", [req.params.id]);
    if (!notification) return res.status(404).json({ ok: false, error: "Not found" });

    const { rows: events } = await db.query("SELECT * FROM notification_events WHERE notification_id = ? ORDER BY created_at ASC", [req.params.id]);

    res.json({
      ok: true,
      notification,
      events
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/notifications/:id/resend
router.post("/notifications/:id/resend", async (req, res) => {
  try {
    const { rows: [notification] } = await db.query("SELECT * FROM notifications WHERE id = ?", [req.params.id]);
    if (!notification) return res.status(404).json({ ok: false, error: "Not found" });

    // Mark as pending and reset attempts
    await db.query("UPDATE notifications SET status = 'PENDING', attempt_count = 0, last_error = NULL WHERE id = ?", [req.params.id]);

    // Track resent event
    await db.query(`
        INSERT INTO notification_events (notification_id, event, metadata_json)
        VALUES (?, ?, ?)
    `, [req.params.id, 'NOTIFICATION_RESENT', JSON.stringify({ trigger: 'admin_manual' })]);

    // Re-enqueue
    const queue = require("../services/queue");
    await queue.notificationQueue.add('deliver', { notificationId: req.params.id });

    res.json({ ok: true, message: "Notification re-enqueued for delivery." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/notifications/:id/cancel
router.post("/notifications/:id/cancel", async (req, res) => {
  try {
    await db.query("UPDATE notifications SET status = 'CANCELED' WHERE id = ? AND status = 'PENDING'", [req.params.id]);
    await db.query(`
        INSERT INTO notification_events (notification_id, event, metadata_json)
        VALUES (?, ?, ?)
    `, [req.params.id, 'NOTIFICATION_CANCELED', JSON.stringify({ trigger: 'admin_manual' })]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/tenants/:id/notification-preferences
router.get("/tenants/:id/notification-preferences", async (req, res) => {
  try {
    const { rows: [prefs] } = await db.query("SELECT * FROM tenant_notification_preferences WHERE tenant_id = ?", [req.params.id]);
    res.json({ ok: true, prefs: prefs || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// PUT /api/admin/tenants/:id/notification-preferences
router.put("/tenants/:id/notification-preferences", async (req, res) => {
  const { id } = req.params;
  const body = req.body;

  const fields = Object.keys(body).filter(k => k !== 'tenant_id' && k !== 'created_at' && k !== 'updated_at');
  if (fields.length === 0) return res.status(400).json({ ok: false, error: "No fields to update" });

  const setClause = fields.map(f => `${f} = ?`).join(", ");
  const values = fields.map(f => (f === 'email_recipients_json' ? JSON.stringify(body[f]) : body[f]));

  try {
    await db.query(`
            INSERT INTO tenant_notification_preferences (tenant_id, ${fields.join(", ")})
            VALUES (?, ${fields.map(() => "?").join(", ")})
            ON DUPLICATE KEY UPDATE ${setClause}
        `, [id, ...values, ...values]);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/engagement-signals
router.get('/engagement-signals', async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT 
                ee.*,
                t.name as tenant_name
            FROM engagement_events ee
            JOIN tenants t ON ee.tenant_id = t.id
            ORDER BY ee.created_at DESC
            LIMIT 100
        `);
    res.json({ ok: true, signals: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/engagement-stats
router.get('/engagement-stats', async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT 
                signal_type, 
                COUNT(*) as count,
                MAX(created_at) as last_seen
            FROM engagement_events
            GROUP BY signal_type
        `);
    res.json({ ok: true, stats: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/cs-workflows
router.get('/cs-workflows', async (req, res) => {
  try {
    const { rows } = await db.query(`
            SELECT 
                cw.*,
                t.name as tenant_name
            FROM cs_workflows cw
            JOIN tenants t ON cw.tenant_id = t.id
            ORDER BY cw.updated_at DESC
            LIMIT 100
        `);
    res.json({ ok: true, workflows: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Sub-routers moved to the top for priority matching

// Diagnostic Catch-all for Admin
router.all(/^(.*)$/, (req, res) => {
  console.warn(`[ADMIN-ROUTER-FALLTHROUGH] ${req.method} ${req.originalUrl} | Path: ${req.path}`);
  res.status(404).json({
    error: `[ADMIN-ROUTER-FALLTHROUGH] Route not found in admin router: ${req.originalUrl}`,
    method: req.method,
    path: req.path,
    baseUrl: req.baseUrl
  });
});

module.exports = router;
