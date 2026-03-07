const express = require('express');
const router = express.Router();
const financialLedgerService = require('../services/financialLedgerService');
const invoiceService = require('../services/invoiceService');
const payoutService = require('../services/payoutService');
const settlementService = require('../services/settlementService');
const db = require('../services/db');

/**
 * Autonomy Finance Admin Routes
 */

// List Transactions
router.get('/transactions', async (req, res) => {
    try {
        const { rows } = await db.query(`
            SELECT t.*, j.original_name as job_name 
            FROM financial_transactions t
            LEFT JOIN jobs j ON t.job_id = j.id
            ORDER BY t.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Transaction Detail
router.get('/transactions/:id', async (req, res) => {
    try {
        const tx = await financialLedgerService.getTransaction(req.params.id);
        if (!tx) return res.status(404).json({ error: 'Transaction not found' });

        const invoices = await invoiceService.getInvoices(req.params.id);
        const { rows: payouts } = await db.query('SELECT * FROM payouts WHERE transaction_id = ?', [req.params.id]);

        res.json({ ...tx, invoices, payouts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Finance Summary Metrics
router.get('/metrics', async (req, res) => {
    try {
        const { rows: [metrics] } = await db.query(`
            SELECT 
                COUNT(*) as total_count,
                SUM(gross_amount) as total_gross,
                SUM(platform_fee) as total_fees,
                SUM(CASE WHEN transaction_status = 'SETTLED' THEN 1 ELSE 0 END) as settled_count
            FROM financial_transactions
        `);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
