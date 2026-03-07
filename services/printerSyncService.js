const db = require('./db');
const crypto = require('crypto');

class PrinterSyncService {
    /**
     * Validates a printer API key.
     * Authorization: Bearer ppk_printer_xxx
     */
    async validatePrinterKey(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const rawKey = authHeader.split(' ')[1];
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        const { rows } = await db.query(
            'SELECT id, name FROM printer_nodes WHERE printer_api_key_hash = ? AND status = "ACTIVE"',
            [keyHash]
        );

        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Updates production capacity for a printer.
     */
    async updateCapacity(printerId, payload) {
        const { date, capacity_total, capacity_available, lead_time_days } = payload;

        // Upsert capacity
        const syncId = `sync_${Date.now()}`;
        await db.query(`
            INSERT INTO printer_capacity (id, printer_id, date, capacity_total, capacity_available, lead_time_days, source, sync_id)
            VALUES (?, ?, ?, ?, ?, ?, 'SYNC_API', ?)
            ON DUPLICATE KEY UPDATE 
                capacity_total = VALUES(capacity_total),
                capacity_available = VALUES(capacity_available),
                lead_time_days = VALUES(lead_time_days),
                source = 'SYNC_API',
                sync_id = VALUES(sync_id)
        `, [crypto.randomUUID(), printerId, date, capacity_total, capacity_available, lead_time_days, syncId]);

        // Update last sync
        await db.query(
            'UPDATE printer_nodes SET last_sync_at = NOW(), sync_status = "HEALTHY" WHERE id = ?',
            [printerId]
        );

        return { success: true, syncId };
    }

    /**
     * Updates machine health and status.
     */
    async updateMachines(printerId, machineUpdates) {
        for (const update of machineUpdates) {
            await db.query(`
                UPDATE printer_machines 
                SET status = ?, machine_health = ?, last_status_update = NOW()
                WHERE id = ? AND printer_id = ?
            `, [update.status, update.machine_health, update.machine_id, printerId]);
        }

        await db.query(
            'UPDATE printer_nodes SET last_sync_at = NOW(), sync_status = "HEALTHY" WHERE id = ?',
            [printerId]
        );

        return { success: true };
    }

    /**
     * Evaluates sync health across the network.
     * 6h -> STALE, 24h -> OFFLINE
     */
    async evaluateNetworkSyncHealth() {
        const now = new Date();

        // Move to STALE
        await db.query(`
            UPDATE printer_nodes 
            SET sync_status = 'STALE'
            WHERE last_sync_at < DATE_SUB(NOW(), INTERVAL 6 HOUR)
              AND sync_status = 'HEALTHY'
        `);

        // Move to OFFLINE
        await db.query(`
            UPDATE printer_nodes 
            SET sync_status = 'OFFLINE'
            WHERE last_sync_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
              AND sync_status != 'OFFLINE'
        `);

        console.log('[SYNC-SERVICE] Network health evaluated');
    }
}

module.exports = new PrinterSyncService();
