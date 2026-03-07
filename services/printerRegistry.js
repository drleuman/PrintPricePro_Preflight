// services/printerRegistry.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const connectService = require('./connectService');

class PrinterRegistry {
    /**
     * Register a machine for a printer node.
     */
    async registerMachine(printerId, machineData) {
        const id = uuidv4();
        try {
            await db.query(`
                INSERT INTO printer_machines (id, printer_id, machine_profile_id, nickname, capacity_index, status)
                VALUES (?, ?, ?, ?, ?, 'ACTIVE')
            `, [id, printerId, machineData.machineProfileId, machineData.nickname, machineData.capacityIndex || 1.0]);

            // Side effect: Update connect status
            await connectService.updateConnectStatus(printerId);

            return { id, status: 'ACTIVE' };
        } catch (err) {
            console.error('[PRINTER-REGISTRY] Failed to register machine:', err.message);
            throw err;
        }
    }

    /**
     * List all machines for a printer.
     */
    async listMachines(printerId) {
        const { rows } = await db.query(`
            SELECT pm.*, m.name as profile_name
            FROM printer_machines pm
            JOIN machine_profiles m ON pm.machine_profile_id = m.id
            WHERE pm.printer_id = ?
        `, [printerId]);
        return rows;
    }

    /**
     * Remove a machine from a node.
     */
    async removeMachine(printerId, machineId) {
        await db.query('DELETE FROM printer_machines WHERE id = ? AND printer_id = ?', [machineId, printerId]);
        await connectService.updateConnectStatus(printerId);
        return { success: true };
    }
}

module.exports = new PrinterRegistry();
