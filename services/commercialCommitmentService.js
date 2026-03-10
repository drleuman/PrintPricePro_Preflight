const db = require('./db');
const crypto = require('crypto');

/**
 * Commercial Commitment Service
 * Manages the transition from a marketplace agreement to an immutable commercial record.
 */
class CommercialCommitmentService {
    /**
     * Creates a new commercial commitment from a commercially ready session.
     */
    async createCommitmentFromSession(sessionId) {
        try {
            // 1. Fetch session state and selected offer
            const { rows: [session] } = await db.query(`
                SELECT mss.*, po.job_id, po.printer_id, po.machine_id, po.suggested_price, 
                       po.production_cost, po.margin_pct, po.lead_time_days,
                       po.committed_price as negotiate_price, 
                       po.committed_lead_time_days as negotiate_lead_time
                FROM marketplace_session_state mss
                JOIN production_offers po ON mss.selected_offer_id = po.id
                WHERE mss.marketplace_session_id = ? AND mss.state = 'COMMERCIALLY_READY'
            `, [sessionId]);

            if (!session) throw new Error('No commercially ready session found or missing selected offer');

            // 2. Generate transaction reference
            const year = new Date().getFullYear();
            const { rows: [count] } = await db.query('SELECT COUNT(*) as total FROM commercial_commitments WHERE created_at >= ?', [new Date(year, 0, 1)]);
            const serial = (count.total + 1).toString().padStart(6, '0');
            const transactionRef = `PPC-${year}-${serial}`;

            // 3. Compute commitment financials (final lock of terms)
            const committedPrice = session.negotiate_price || session.suggested_price;
            const committedCost = session.production_cost;
            const committedMargin = committedPrice - committedCost;
            const committedMarginPct = (committedMargin / committedPrice) * 100;
            const committedLeadTime = session.negotiate_lead_time || session.lead_time_days;

            const commitmentId = crypto.randomUUID();

            // 4. Create commitment record
            await db.query(`
                INSERT INTO commercial_commitments (
                    id, job_id, marketplace_session_id, selected_offer_id, 
                    printer_id, machine_id, committed_price, committed_production_cost,
                    committed_margin, committed_margin_pct, committed_lead_time_days,
                    commercial_commitment_status, settlement_readiness_status,
                    transaction_reference
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', 'NOT_READY', ?)
            `, [
                commitmentId, session.job_id, sessionId, session.selected_offer_id,
                session.printer_id, session.machine_id, committedPrice, committedCost,
                committedMargin, committedMarginPct, committedLeadTime, transactionRef
            ]);

            // 5. Initial events
            await this.logCommitmentEvent(commitmentId, 'COMMITMENT_CREATED', { transaction_reference: transactionRef });

            return commitmentId;
        } catch (err) {
            console.error('[COMMERCIAL-COMMITMENT] Creation failed:', err.message);
            throw err;
        }
    }

    /**
     * Locks a commitment to prevent further edits.
     */
    async lockCommitment(commitmentId) {
        await db.query(`
            UPDATE commercial_commitments 
            SET commercial_commitment_status = 'LOCKED' 
            WHERE id = ? AND commercial_commitment_status = 'READY'
        `, [commitmentId]);

        await this.logCommitmentEvent(commitmentId, 'COMMITMENT_LOCKED', {});
    }

    /**
     * Voids a commitment.
     */
    async voidCommitment(commitmentId) {
        await db.query(`
            UPDATE commercial_commitments 
            SET commercial_commitment_status = 'VOIDED' 
            WHERE id = ? AND commercial_commitment_status IN ('DRAFT', 'READY')
        `, [commitmentId]);

        await this.logCommitmentEvent(commitmentId, 'COMMITMENT_VOIDED', {});
    }

    /**
     * Attaches an external ledger reference.
     */
    async attachLedgerReference(commitmentId, ledgerRef) {
        await db.query(`
            UPDATE commercial_commitments 
            SET ledger_reference = ? 
            WHERE id = ?
        `, [ledgerRef, commitmentId]);

        await this.logCommitmentEvent(commitmentId, 'LEDGER_REFERENCE_ATTACHED', { ledger_reference: ledgerRef });
    }

    async logCommitmentEvent(commitmentId, type, metadata = {}) {
        await db.query(`
            INSERT INTO commercial_commitment_events (id, commercial_commitment_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?)
        `, [crypto.randomUUID(), commitmentId, type, JSON.stringify(metadata)]);
    }

    async getCommitment(commitmentId) {
        const { rows } = await db.query(`
            SELECT cc.*, p.name as printer_name, j.original_name as job_name
            FROM commercial_commitments cc
            JOIN printer_nodes p ON cc.printer_id = p.id
            JOIN jobs j ON cc.job_id = j.id
            WHERE cc.id = ?
        `, [commitmentId]);
        return rows[0];
    }
}

module.exports = new CommercialCommitmentService();
