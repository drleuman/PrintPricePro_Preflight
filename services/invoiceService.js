const db = require('./db');
const crypto = require('crypto');

/**
 * Invoice Service
 * Manages the generation and issuance of customer and printer invoices.
 */
class InvoiceService {
    /**
     * Generates a customer invoice for a transaction.
     */
    async generateCustomerInvoice(transactionId) {
        const { rows: [tx] } = await db.query('SELECT * FROM financial_transactions WHERE id = ?', [transactionId]);
        if (!tx) throw new Error('Transaction not found');

        const invoiceId = crypto.randomUUID();
        const invoiceNumber = `INV-C-${tx.transaction_reference.split('-').slice(1).join('-')}`;

        await db.query(`
            INSERT INTO invoices (id, transaction_id, invoice_number, invoice_type, currency, amount, invoice_status)
            VALUES (?, ?, ?, 'CUSTOMER', ?, ?, 'ISSUED')
        `, [invoiceId, transactionId, invoiceNumber, tx.currency, tx.gross_amount]);

        return invoiceId;
    }

    /**
     * Generates a printer payout invoice for a transaction.
     */
    async generatePrinterInvoice(transactionId) {
        const { rows: [tx] } = await db.query('SELECT * FROM financial_transactions WHERE id = ?', [transactionId]);
        if (!tx) throw new Error('Transaction not found');

        const invoiceId = crypto.randomUUID();
        const invoiceNumber = `INV-P-${tx.transaction_reference.split('-').slice(1).join('-')}`;

        await db.query(`
            INSERT INTO invoices (id, transaction_id, invoice_number, invoice_type, currency, amount, invoice_status)
            VALUES (?, ?, ?, 'PRINTER', ?, ?, 'ISSUED')
        `, [invoiceId, transactionId, invoiceNumber, tx.currency, tx.printer_payout]);

        return invoiceId;
    }

    async getInvoices(transactionId) {
        const { rows } = await db.query('SELECT * FROM invoices WHERE transaction_id = ?', [transactionId]);
        return rows;
    }
}

module.exports = new InvoiceService();
