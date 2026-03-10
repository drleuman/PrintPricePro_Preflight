const db = require('./db');
const crypto = require('crypto');

/**
 * Settlement Readiness Service
 * Prepares commitments for future payout and invoicing.
 */
class SettlementReadinessService {
    /**
     * Builds or updates the settlement placeholder for a commitment.
     */
    async buildSettlementPlaceholder(commitmentId) {
        try {
            const { rows: [cc] } = await db.query('SELECT * FROM commercial_commitments WHERE id = ?', [commitmentId]);
            if (!cc) throw new Error('Commitment not found');

            // Simplified placeholder model
            // gross_value = committed_price
            // platform_fee = committed_margin
            // payable_to_printer = committed_price - platform_fee

            const grossValue = parseFloat(cc.committed_price);
            const platformFee = parseFloat(cc.committed_margin);
            const payableToPrinter = grossValue - platformFee;

            await db.query(`
                INSERT INTO settlement_placeholders (
                    id, commercial_commitment_id, payable_to_printer, platform_fee, 
                    gross_value, settlement_currency, settlement_status
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
                ON DUPLICATE KEY UPDATE 
                    payable_to_printer = VALUES(payable_to_printer),
                    platform_fee = VALUES(platform_fee),
                    gross_value = VALUES(gross_value),
                    settlement_status = 'PENDING'
            `, [crypto.randomUUID(), commitmentId, payableToPrinter, platformFee, grossValue, cc.currency]);

            await this.recomputeSettlementState(commitmentId);
        } catch (err) {
            console.error('[SETTLEMENT-READINESS] Build failed:', err.message);
            throw err;
        }
    }

    /**
     * Evaluates and updates the readiness status.
     */
    async recomputeSettlementState(commitmentId) {
        try {
            const { rows: [cc] } = await db.query('SELECT * FROM commercial_commitments WHERE id = ?', [commitmentId]);
            const { rows: [sp] } = await db.query('SELECT * FROM settlement_placeholders WHERE commercial_commitment_id = ?', [commitmentId]);

            let readinessStatus = 'NOT_READY';

            // Logic for ready for invoice
            if (cc.transaction_reference && cc.committed_price > 0 && cc.commercial_commitment_status !== 'VOIDED') {
                readinessStatus = 'READY_FOR_INVOICE';
            }

            // Logic for ready for payout
            if (readinessStatus === 'READY_FOR_INVOICE' && cc.commercial_commitment_status === 'LOCKED' && sp.payable_to_printer > 0) {
                readinessStatus = 'READY_FOR_PAYOUT';
            }

            await db.query('UPDATE commercial_commitments SET settlement_readiness_status = ? WHERE id = ?', [readinessStatus, commitmentId]);

            if (readinessStatus !== cc.settlement_readiness_status) {
                await this.logCommitmentEvent(commitmentId, 'SETTLEMENT_READINESS_CHANGED', { from: cc.settlement_readiness_status, to: readinessStatus });
            }
        } catch (err) {
            console.error('[SETTLEMENT-READINESS] State recompute failed:', err.message);
        }
    }

    async logCommitmentEvent(commitmentId, type, metadata = {}) {
        await db.query(`
            INSERT INTO commercial_commitment_events (id, commercial_commitment_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?)
        `, [crypto.randomUUID(), commitmentId, type, JSON.stringify(metadata)]);
    }
}

module.exports = new SettlementReadinessService();
