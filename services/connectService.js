// services/connectService.js
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class ConnectService {
    /**
     * Create a new printer node (Initial Onboarding).
     */
    async createPrinterNode(data) {
        const id = uuidv4();
        const apiKey = `ppp_pr_${crypto.randomBytes(24).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        try {
            await db.query(`
                INSERT INTO printer_nodes (id, name, legal_name, vat_id, website, country, city, status, connect_status, printer_api_key_hash, quality_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_REVIEW', 'NOT_CONFIGURED', ?, 0.5)
            `, [id, data.name, data.legal_name, data.vat_id, data.website, data.country, data.city, apiKeyHash]);

            if (data.contact) {
                await this.addContact(id, data.contact);
            }

            console.log(`[CONNECT-SERVICE] Created printer node: ${data.name} (${id})`);

            // Return BOTH id and the raw apiKey (only time it's shared)
            return { id, apiKey, status: 'PENDING_REVIEW' };
        } catch (err) {
            console.error('[CONNECT-SERVICE] Failed to create printer node:', err.message);
            throw err;
        }
    }

    /**
     * Update printer identity profile.
     */
    async updatePrinterProfile(id, data) {
        const allowedFields = ['name', 'legal_name', 'website', 'country', 'city', 'sla_tier'];
        const updates = [];
        const params = [];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                params.push(data[field]);
            }
        }

        if (updates.length === 0) return { success: false, message: 'No valid fields provided' };

        params.push(id);
        await db.query(`UPDATE printer_nodes SET ${updates.join(', ')} WHERE id = ?`, params);
        return { success: true };
    }

    /**
     * Logic to update connect_status based on configuration.
     */
    async updateConnectStatus(id) {
        try {
            const { rows: machines } = await db.query('SELECT count(*) as count FROM printer_machines WHERE printer_id = ?', [id]);
            const { rows: capacity } = await db.query('SELECT count(*) as count FROM printer_capacity WHERE printer_id = ?', [id]);

            let newStatus = 'NOT_CONFIGURED';
            if (machines[0].count > 0 && capacity[0].count > 0) {
                newStatus = 'READY';
            } else if (machines[0].count > 0 || capacity[0].count > 0) {
                newStatus = 'PARTIALLY_CONFIGURED';
            }

            await db.query('UPDATE printer_nodes SET connect_status = ? WHERE id = ?', [newStatus, id]);
            return newStatus;
        } catch (err) {
            console.error('[CONNECT-SERVICE] Failed to update connect status:', err.message);
            throw err;
        }
    }

    /**
     * Add a contact to a printer node.
     */
    async addContact(printerId, contact) {
        const id = uuidv4();
        await db.query(`
            INSERT INTO printer_contacts (id, printer_id, name, email, role)
            VALUES (?, ?, ?, ?, ?)
        `, [id, printerId, contact.name, contact.email, contact.role]);
    }

    /**
     * Get consolidated printer profile.
     */
    async getPrinterProfile(printerId) {
        const { rows: [node] } = await db.query('SELECT id, name, legal_name, website, country, city, status, connect_status, quality_score, price_index, sla_tier, created_at FROM printer_nodes WHERE id = ?', [printerId]);
        if (!node) return null;

        const { rows: machines } = await db.query(`
            SELECT pm.*, m.name as profile_name, m.type as profile_type
            FROM printer_machines pm
            JOIN machine_profiles m ON pm.machine_profile_id = m.id
            WHERE pm.printer_id = ?
        `, [printerId]);

        const { rows: papers } = await db.query(`
            SELECT pp.*, p.name as paper_name
            FROM printer_papers pp
            JOIN paper_profiles p ON pp.paper_profile_id = p.id
            WHERE pp.printer_id = ?
        `, [printerId]);

        return {
            ...node,
            machines,
            papers
        };
    }
}

module.exports = new ConnectService();
