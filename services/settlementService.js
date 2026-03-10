const financialLedgerService = require('./financialLedgerService');
const invoiceService = require('./invoiceService');
const payoutService = require('./payoutService');
const db = require('./db');

/**
 * Settlement Service
 * Orchestrates the financial lifecycle from transaction to final settlement.
 */
class SettlementService {
    /**
     * Processes a transaction through the settlement lifecycle.
     */
    async executeSettlementFlow(transactionId) {
        try {
            const tx = await financialLedgerService.getTransaction(transactionId);
            if (!tx) throw new Error('Transaction not found');

            // 1. Generate Invoices
            console.log(`[SETTLEMENT] Generating invoices for TXN ${transactionId}...`);
            await invoiceService.generateCustomerInvoice(transactionId);
            await invoiceService.generatePrinterInvoice(transactionId);
            await financialLedgerService.updateTransactionStatus(transactionId, 'INVOICED');

            // 2. Schedule Payout
            console.log(`[SETTLEMENT] Scheduling payout for TXN ${transactionId}...`);
            const payoutId = await payoutService.schedulePrinterPayout(transactionId);
            await financialLedgerService.updateTransactionStatus(transactionId, 'SETTLEMENT_SCHEDULED');

            // 3. Execute Settlement (Simulated completion)
            console.log(`[SETTLEMENT] Executing payout ${payoutId}...`);
            const extRef = await payoutService.executePayout(payoutId);

            // 4. Record Final Ledger Entries (Escrow release to Printer & platform)
            await financialLedgerService.createLedgerEntries(transactionId, [
                { type: 'DEBIT', account: 'ESCROW', amount: tx.printer_payout, currency: tx.currency, metadata: { payoutId, extRef } },
                { type: 'CREDIT', account: 'PRINTER', amount: tx.printer_payout, currency: tx.currency },
                { type: 'DEBIT', account: 'ESCROW', amount: tx.platform_fee, currency: tx.currency },
                { type: 'CREDIT', account: 'PLATFORM_REVENUE', amount: tx.platform_fee, currency: tx.currency }
            ]);

            await financialLedgerService.updateTransactionStatus(transactionId, 'SETTLED');
            await financialLedgerService.logSettlementEvent(transactionId, 'TRANSACTION_SETTLED', { externalReference: extRef });

            return { success: true, externalReference: extRef };
        } catch (err) {
            console.error('[SETTLEMENT] Workflow failed:', err.message);
            await financialLedgerService.updateTransactionStatus(transactionId, 'FAILED');
            await financialLedgerService.logSettlementEvent(transactionId, 'TRANSACTION_FAILED', { error: err.message });
            throw err;
        }
    }
}

module.exports = new SettlementService();
