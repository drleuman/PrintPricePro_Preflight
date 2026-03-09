const db = require('./db');
const printerAdapter = require('../adapters/printerCapabilityAdapter');
const paperAdapter = require('../adapters/paperCapabilityAdapter');

/**
 * Capability Sync Service
 * 
 * Orchestrates the retrieval and normalization of Printer and Paper capabilities.
 * Bridges DB records with V3 normalized profiles.
 */
class CapabilitySyncService {
    /**
     * Retrieves all active printers and their machines as normalized profiles.
     * @returns {Promise<Array>} Array of PrinterCapabilityProfile
     */
    async getActivePrinterProfiles() {
        try {
            const { rows } = await db.query(`
                SELECT pn.*, pm.id as machine_id, pm.nickname, pm.capacity_index, 
                       mp.name as profile_name, mp.type as machine_type, 
                       mp.max_tac, mp.min_res_dpi, mp.requires_bleed
                FROM printer_nodes pn
                JOIN printer_machines pm ON pn.id = pm.printer_id
                JOIN machine_profiles mp ON pm.machine_profile_id = mp.id
                WHERE pn.status = 'ACTIVE' AND pm.status = 'ACTIVE'
            `);

            return rows.map(row => {
                const printer = { id: row.id, name: row.name };
                const machine = {
                    id: row.machine_id,
                    type: row.machine_type,
                    max_tac: row.max_tac,
                    min_res_dpi: row.min_res_dpi,
                    requires_bleed: row.requires_bleed
                };
                return printerAdapter.toProfile(printer, machine);
            });
        } catch (err) {
            console.error('[CAPABILITY-SYNC] Failed to fetch printer profiles:', err.message);
            return [];
        }
    }

    /**
     * Retrieves all available paper stocks as normalized profiles.
     * @returns {Promise<Array>} Array of PaperStockProfile
     */
    async getPaperStockProfiles() {
        try {
            const { rows } = await db.query(`
                SELECT pp.*, p.name, p.weight, p.absorption_coefficient, p.icc_profile
                FROM printer_papers pp
                JOIN paper_profiles p ON pp.paper_profile_id = p.id
                WHERE pp.available = TRUE
            `);

            return rows.map(row => paperAdapter.toProfile({
                id: row.paper_profile_id,
                name: row.name,
                weight: row.weight,
                absorption_coefficient: row.absorption_coefficient,
                icc_profile: row.icc_profile
            }));
        } catch (err) {
            console.error('[CAPABILITY-SYNC] Failed to fetch paper profiles:', err.message);
            return [];
        }
    }

    /**
     * Gets a single printer profile by ID.
     */
    async getPrinterProfile(printerId, machineId = null) {
        const query = machineId
            ? `SELECT pn.*, pm.id as machine_id, mp.type as machine_type, mp.max_tac, mp.min_res_dpi 
               FROM printer_nodes pn 
               JOIN printer_machines pm ON pn.id = pm.printer_id 
               JOIN machine_profiles mp ON pm.machine_profile_id = mp.id
               WHERE pn.id = ? AND pm.id = ?`
            : `SELECT pn.*, pm.id as machine_id, mp.type as machine_type, mp.max_tac, mp.min_res_dpi 
               FROM printer_nodes pn 
               JOIN printer_machines pm ON pn.id = pm.printer_id 
               JOIN machine_profiles mp ON pm.machine_profile_id = mp.id
               WHERE pn.id = ? LIMIT 1`;

        const params = machineId ? [printerId, machineId] : [printerId];
        const { rows } = await db.query(query, params);

        if (rows.length === 0) return null;

        const row = rows[0];
        return printerAdapter.toProfile(
            { id: row.id, name: row.name },
            { id: row.machine_id, type: row.machine_type, max_tac: row.max_tac, min_res_dpi: row.min_res_dpi }
        );
    }
}

module.exports = new CapabilitySyncService();
