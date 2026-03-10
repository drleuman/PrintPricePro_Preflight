// services/networkOpsService.js
const db = require('./db');
const printerSyncService = require('./printerSyncService');

class NetworkOpsService {
    /**
     * Refined Network Overview KPIs.
     */
    async getNetworkOverview() {
        try {
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString();

            const { rows: nodes } = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'ACTIVE' AND connect_status = 'READY' THEN 1 END) as routing_ready,
                    COUNT(DISTINCT country || '-' || city) as regions_covered
                FROM printer_nodes
            `);

            const { rows: quality } = await db.query('SELECT AVG(quality_score) as avg_score FROM printer_nodes WHERE status = "ACTIVE"');

            const { rows: capacity } = await db.query(`
                SELECT 
                    SUM(capacity_total) as total_today,
                    SUM(capacity_available) as available_today,
                    COUNT(CASE WHEN capacity_available <= 0 THEN 1 END) as full_today
                FROM printer_capacity 
                WHERE date = ?
            `, [today]);

            // Stale sync = nodes active but no capacity entry or entry older than 24h
            // Now using the formal sync_status field (Phase 26.3)
            const { rows: syncSummary } = await db.query(`
                SELECT 
                    COUNT(CASE WHEN sync_status = 'HEALTHY' THEN 1 END) as healthy,
                    COUNT(CASE WHEN sync_status = 'STALE' THEN 1 END) as stale,
                    COUNT(CASE WHEN sync_status = 'OFFLINE' THEN 1 END) as offline
                FROM printer_nodes 
                WHERE status = 'ACTIVE'
            `);

            const { rows: resMetrics } = await db.query(`
                SELECT 
                    COUNT(CASE WHEN reservation_status = 'ACTIVE' THEN 1 END) as active,
                    COUNT(CASE WHEN reservation_status = 'EXPIRED' THEN 1 END) as expired
                FROM capacity_reservations
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);

            const { rows: dispatchMetrics } = await db.query(`
                SELECT 
                    COUNT(CASE WHEN assignment_status = 'DISPATCHED' THEN 1 END) as active,
                    COUNT(CASE WHEN dispatch_attempt > 1 THEN 1 END) / NULLIF(COUNT(*), 0) as reroute_rate
                FROM job_assignments
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);

            const totalCap = capacity[0].total_today || 0;
            const availCap = capacity[0].available_today || 0;
            const utilization = totalCap > 0 ? ((totalCap - availCap) / totalCap) * 100 : 0;

            return {
                total_printers: nodes[0].total || 0,
                active_printers: nodes[0].active || 0,
                routing_ready_printers: nodes[0].routing_ready || 0,
                avg_quality_score: quality[0].avg_score || 0.5,
                capacity_available_today: availCap,
                capacity_total_today: totalCap,
                capacity_utilization_pct: Math.round(utilization),
                printers_full_today: capacity[0].full_today || 0,
                sync_health: {
                    healthy: syncSummary[0].healthy || 0,
                    stale: syncSummary[0].stale || 0,
                    offline: syncSummary[0].offline || 0
                },
                reservations: {
                    active: resMetrics[0].active || 0,
                    expired_24h: resMetrics[0].expired || 0
                },
                dispatch: {
                    active: dispatchMetrics[0].active || 0,
                    reroute_rate: dispatchMetrics[0].reroute_rate || 0
                },
                timestamp: new Date()
            };
        } catch (err) {
            console.error('[NETWORK-OPS] Overview failed:', err.message);
            throw err;
        }
    }

    /**
     * Paginated printer list with filters.
     */
    async listPrinters(filters = {}, options = {}) {
        const { country, status, connect_status, routing_eligible } = filters;
        const { limit = 20, offset = 0 } = options;
        const today = new Date().toISOString().split('T')[0];

        try {
            let query = `
                SELECT p.*, 
                       (SELECT count(*) FROM printer_machines WHERE printer_id = p.id) as machines_count,
                       pc.capacity_available as capacity_available_today,
                       pc.capacity_total as capacity_total_today,
                       pc.lead_time_days
                FROM printer_nodes p
                LEFT JOIN printer_capacity pc ON p.id = pc.printer_id AND pc.date = ?
                WHERE 1=1
            `;
            const params = [today];

            if (country) {
                query += ` AND p.country = ?`;
                params.push(country);
            }
            if (status) {
                query += ` AND p.status = ?`;
                params.push(status);
            }
            if (connect_status) {
                query += ` AND p.connect_status = ?`;
                params.push(connect_status);
            }
            if (routing_eligible !== undefined) {
                const isEligible = routing_eligible === 'true' || routing_eligible === true;
                if (isEligible) {
                    query += ` AND p.status = 'ACTIVE' AND p.connect_status = 'READY'`;
                } else {
                    query += ` AND (p.status != 'ACTIVE' OR p.connect_status != 'READY')`;
                }
            }

            query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const { rows } = await db.query(query, params);

            // Add derived routing_eligible flag to each row
            const enrichedRows = rows.map(r => ({
                ...r,
                routing_eligible: r.status === 'ACTIVE' && r.connect_status === 'READY' && r.machines_count > 0,
                last_capacity_update_at: r.updated_at // Simple mapping for now
            }));

            return enrichedRows;
        } catch (err) {
            console.error('[NETWORK-OPS] List printers failed:', err.message);
            throw err;
        }
    }

    /**
     * Deep dive detail for a printer node.
     */
    async getPrinterDetail(id) {
        try {
            const { rows: [node] } = await db.query('SELECT * FROM printer_nodes WHERE id = ?', [id]);
            if (!node) throw new Error('Printer not found');

            const { rows: machines } = await db.query('SELECT * FROM printer_machines pm JOIN machine_profiles m ON pm.machine_profile_id = m.id WHERE pm.printer_id = ?', [id]);
            const { rows: capacity } = await db.query('SELECT * FROM printer_capacity WHERE printer_id = ? ORDER BY date DESC LIMIT 7', [id]);
            const { rows: regions } = await db.query('SELECT * FROM printer_service_regions WHERE printer_id = ?', [id]);
            const { rows: reservations } = await db.query(
                "SELECT * FROM capacity_reservations WHERE printer_id = ? AND reservation_status = 'ACTIVE' ORDER BY created_at DESC",
                [id]
            );
            const { rows: assignments } = await db.query(
                "SELECT * FROM job_assignments WHERE printer_id = ? ORDER BY created_at DESC LIMIT 10",
                [id]
            );
            const { rows: economicMetrics } = await db.query(`
                SELECT 
                    AVG(margin_pct) as avg_margin,
                    COUNT(*) as total_quotes,
                    (SELECT COUNT(*) FROM economic_routing_audit WHERE selected_printer_id = ?) as selection_count
                FROM job_quotes
                WHERE printer_id = ?
            `, [id, id]);

            const { rows: offerMetrics } = await db.query(`
                SELECT 
                    COUNT(*) as total_offers,
                    SUM(CASE WHEN offer_status = 'ACCEPTED' THEN 1 ELSE 0 END) as accepted_count,
                    SUM(CASE WHEN offer_status = 'EXPIRED' THEN 1 ELSE 0 END) as expired_count,
                    AVG(CASE WHEN offer_status = 'ACCEPTED' THEN TIMESTAMPDIFF(SECOND, created_at, updated_at) END) as avg_response_sec
                FROM production_offers
                WHERE printer_id = ?
            `, [id]);

            // Health Warnings Logic
            const warnings = [];
            if (node.status === 'OFFLINE') warnings.push({ type: 'PRINTER_OFFLINE', severity: 'CRITICAL', message: 'Node reported offline status.' });
            if (node.status === 'SUSPENDED') warnings.push({ type: 'PRINTER_SUSPENDED', severity: 'WARNING', message: 'Node is administratively suspended.' });
            if (node.connect_status !== 'READY') warnings.push({ type: 'CONNECT_NOT_READY', severity: 'WARNING', message: `Connect status is ${node.connect_status}.` });
            if (machines.length === 0) warnings.push({ type: 'NO_MACHINES_REGISTERED', severity: 'CRITICAL', message: 'No production hardware registered.' });

            const today = new Date().toISOString().split('T')[0];
            const hasTodayCap = capacity.some(c => c.date === today);
            if (!hasTodayCap) warnings.push({ type: 'NO_CAPACITY_DATA', severity: 'WARNING', message: 'Missing capacity declaration for today.' });

            const todayCap = capacity.find(c => c.date === today);
            if (todayCap && todayCap.capacity_available <= 0) warnings.push({ type: 'CAPACITY_FULL', severity: 'WARNING', message: 'No available capacity remaining today.' });

            if (node.sync_status === 'STALE') warnings.push({ type: 'SYNC_STALE', severity: 'WARNING', message: 'No sync data received in the last 6 hours.' });
            if (node.sync_status === 'OFFLINE') warnings.push({ type: 'SYNC_OFFLINE', severity: 'CRITICAL', message: 'No sync data received in the last 24 hours. Routing disabled.' });

            return {
                profile: node,
                machines,
                capacity,
                service_regions: regions,
                health_warnings: warnings,
                reservations,
                assignments,
                eligibility: {
                    is_eligible: node.status === 'ACTIVE' && node.connect_status === 'READY' && machines.length > 0,
                    reasons: [
                        { label: 'Active Status', met: node.status === 'ACTIVE' },
                        { label: 'Connect Ready', met: node.connect_status === 'READY' },
                        { label: 'Machines Registered', met: machines.length > 0 },
                        { label: 'Sync Status', met: node.sync_status !== 'OFFLINE' },
                        { label: 'Capacity Declared', met: hasTodayCap }
                    ]
                },
                economic: {
                    avg_margin: economicMetrics[0].avg_margin || 0,
                    total_quotes: economicMetrics[0].total_quotes || 0,
                    selection_count: economicMetrics[0].selection_count || 0,
                    selection_rate: economicMetrics[0].total_quotes > 0
                        ? (economicMetrics[0].selection_count / economicMetrics[0].total_quotes) * 100
                        : 0
                }
            };
        } catch (err) {
            console.error('[NETWORK-OPS] Get detail failed:', err.message);
            throw err;
        }
    }

    /**
     * Regional capacity aggregation.
     */
    async getCapacityByRegion() {
        const today = new Date().toISOString().split('T')[0];
        try {
            const { rows } = await db.query(`
                SELECT 
                    p.country,
                    p.city as region,
                    COUNT(p.id) as printers,
                    SUM(pc.capacity_total) as capacity_total_today,
                    SUM(pc.capacity_available) as capacity_available_today
                FROM printer_nodes p
                LEFT JOIN printer_capacity pc ON p.id = pc.printer_id AND pc.date = ?
                WHERE p.status = 'ACTIVE'
                GROUP BY p.country, p.city
            `, [today]);

            return rows.map(r => ({
                ...r,
                capacity_utilization_pct: r.capacity_total_today > 0
                    ? Math.round(((r.capacity_total_today - r.capacity_available_today) / r.capacity_total_today) * 100)
                    : 0
            }));
        } catch (err) {
            console.error('[NETWORK-OPS] Capacity by region failed:', err.message);
            throw err;
        }
    }

    /**
     * Consolidated health warnings.
     */
    async getHealthWarnings() {
        try {
            const allPrinters = await this.listPrinters();
            const allWarnings = [];

            for (const p of allPrinters) {
                const detail = await this.getPrinterDetail(p.id);
                detail.health_warnings.forEach(w => {
                    allWarnings.push({
                        ...w,
                        printer_id: p.id,
                        printer_name: p.name,
                        evaluated_at: new Date()
                    });
                });
            }

            return allWarnings;
        } catch (err) {
            console.error('[NETWORK-OPS] Health warnings failed:', err.message);
            throw err;
        }
    }

    /**
     * Get Sync Status Details (Phase 26.3)
     */
    async getSyncStatusDetails() {
        // Trigger health evaluation first
        await printerSyncService.evaluateNetworkSyncHealth();

        const { rows: alerts } = await db.query(`
            SELECT id, name, last_sync_at, sync_status
            FROM printer_nodes
            WHERE status = 'ACTIVE' AND sync_status != 'HEALTHY'
            ORDER BY last_sync_at ASC
            LIMIT 20
        `);

        return alerts;
    }
}

module.exports = new NetworkOpsService();
