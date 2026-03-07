const db = require('./db');
const crypto = require('crypto');

/**
 * Financial Ledger Service
 * Maintains the immutable double-entry ledger for platform transactions.
 */
class FinancialLedgerService {
    /**
     * Creates a financial transaction from a commercial commitment.
     */
    async createFinancialTransaction(commitmentId) {
        const { rows: [commitment] } = await db.query(`
            SELECT * FROM commercial_commitments WHERE id = ?
        `, [commitmentId]);

        if (!commitment) throw new Error('Commercial commitment not found');

        const transactionId = crypto.randomUUID();
        const transactionRef = `TXN-${commitment.transaction_reference.split('-').slice(1).join('-')}`;

        const gross = parseFloat(commitment.committed_price);
        const cost = parseFloat(commitment.committed_production_cost);
        const fee = parseFloat(commitment.committed_margin);
        const payout = cost; // Simplifying: payout is production cost in this phase

        await db.query(`
            INSERT INTO financial_transactions (
                id, transaction_reference, commercial_commitment_id, job_id, printer_id,
                currency, gross_amount, production_cost, platform_fee, printer_payout,
                transaction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CREATED')
        `, [
            transactionId, transactionRef, commitmentId, commitment.job_id, commitment.printer_id,
            commitment.currency, gross, cost, fee, payout
        ]);

        await this.logSettlementEvent(transactionId, 'TRANSACTION_CREATED', { commitmentId, transactionRef });

        // Initial Ledger Entries (Customer Debt & Escrow Credit)
        await this.createLedgerEntries(transactionId, [
            { type: 'DEBIT', account: 'CUSTOMER', amount: gross, currency: commitment.currency },
            { type: 'CREDIT', account: 'ESCROW', amount: gross, currency: commitment.currency }
        ]);

        return transactionId;
    }

    /**
     * Records double-entry items in the ledger.
     */
    async createLedgerEntries(transactionId, entries) {
        for (const entry of entries) {
            await db.query(`
                INSERT INTO financial_ledger_entries (id, transaction_id, entry_type, account_type, amount, currency, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                crypto.randomUUID(), transactionId, entry.type, entry.account,
                entry.amount, entry.currency || 'EUR', JSON.stringify(entry.metadata || {})
            ]);
        }
    }

    async getTransaction(id) {
        const { rows: [tx] } = await db.query('SELECT * FROM financial_transactions WHERE id = ?', [id]);
        if (!tx) return null;

        const { rows: ledger } = await db.query('SELECT * FROM financial_ledger_entries WHERE transaction_id = ? ORDER BY created_at ASC', [id]);
        const { rows: events } = await db.query('SELECT * FROM settlement_events WHERE transaction_id = ? ORDER BY created_at ASC', [id]);

        return { ...tx, ledger, events };
    }

    async updateTransactionStatus(id, status) {
        await db.query('UPDATE financial_transactions SET transaction_status = ? WHERE id = ?', [status, id]);
        await this.logSettlementEvent(id, 'STATUS_UPDATED', { status });
    }

    async logSettlementEvent(transactionId, type, metadata = {}) {
        await db.query(`
            INSERT INTO settlement_events (id, transaction_id, event_type, metadata_json)
            VALUES (?, ?, ?, ?)
        `, [crypto.randomUUID(), transactionId, type, JSON.stringify(metadata)]);
    }
}

module.exports = new FinancialLedgerService();
