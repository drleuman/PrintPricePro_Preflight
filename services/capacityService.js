// services/capacityService.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const connectService = require('./connectService');

class CapacityService {
    /**
     * Update operational capacity for a specific date.
     */
    async updateCapacity(printerId, date, data) {
        const id = uuidv4();
        try {
            await db.query(`
                INSERT INTO printer_capacity (id, printer_id, date, capacity_total, capacity_available, lead_time_days)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    capacity_total = VALUES(capacity_total),
                    capacity_available = VALUES(capacity_available),
                    lead_time_days = VALUES(lead_time_days)
            `, [id, printerId, date, data.total, data.available, data.leadTimeDays || 3]);

            // Side effect: Update connect status
            await connectService.updateConnectStatus(printerId);

            return { success: true };
        } catch (err) {
            console.error('[CAPACITY-SERVICE] Failed to update capacity:', err.message);
            throw err;
        }
    }

    /**
     * Get capacity history/future for a printer.
     */
    async getPrinterCapacity(printerId, startDate, endDate) {
        const { rows } = await db.query(`
            SELECT * FROM printer_capacity 
            WHERE printer_id = ? AND date BETWEEN ? AND ?
            ORDER BY date ASC
        `, [printerId, startDate, endDate]);
        return rows;
    }
}

module.exports = new CapacityService();
