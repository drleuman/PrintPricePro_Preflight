const db = require('./db');
const crypto = require('crypto');

/**
 * Payout Service
 * Handles scheduling and execution of global printer payouts.
 */
class PayoutService {
    async schedulePrinterPayout(transactionId) {
        const { rows: [tx] } = await db.query('SELECT * FROM financial_transactions WHERE id = ?', [transactionId]);
        if (!tx) throw new Error('Transaction not found');

        const payoutId = crypto.randomUUID();

        await db.query(`
            INSERT INTO payouts (id, transaction_id, printer_id, currency, payout_amount, payout_status)
            VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
        `, [payoutId, transactionId, tx.printer_id, tx.currency, tx.printer_payout]);

        return payoutId;
    }

    async executePayout(payoutId) {
        // Logic to interface with external providers (Stripe, Wise, etc.)
        // For Phase 31, we simulate a successful payout.

        const { rows: [payout] } = await db.query('SELECT * FROM payouts WHERE id = ?', [payoutId]);
        const externalRef = `XP-${payoutId.slice(0, 8).toUpperCase()}`;

        await db.query(`
            UPDATE payouts 
            SET payout_status = 'COMPLETED', external_reference = ?, payout_provider = 'SIMULATED_PROVIDER'
            WHERE id = ?
        `, [externalRef, payoutId]);

        return externalRef;
    }
}

module.exports = new PayoutService();
