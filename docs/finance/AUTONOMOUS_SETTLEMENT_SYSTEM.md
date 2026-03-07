# Autonomous Settlement System (Phase 31)

The Autonomous Settlement System transforms commercial agreements into immutable financial records, managing the movement of funds from customer ingestion to printer payout.

## Financial Lifecycle

1.  **TRANSACTION_CREATED**: Triggered upon commercial commitment. Ledger entries record the gross debt from the customer.
2.  **INVOICED**: Customer and Printer invoices are generated and issued (DRAFT → ISSUED).
3.  **SETTLEMENT_SCHEDULED**: Printer payouts are calculated and scheduled in the `payouts` registry.
4.  **SETTLED**: Funds are released from Escrow. Platform revenue is recognized. Printer account is credited.

## Immutable Ledger Design

The system implements a **Double-Entry Accounting** model at the data layer. Every economic event creates balancing `DEBIT` and `CREDIT` entries.

### Example: Transaction Initialization
| Account | Type | Amount |
| :--- | :--- | :--- |
| CUSTOMER | DEBIT | Gross Price |
| ESCROW | CREDIT | Gross Price |

### Example: Final Settlement
| Account | Type | Amount |
| :--- | :--- | :--- |
| ESCROW | DEBIT | Printer Payout |
| PRINTER | CREDIT | Printer Payout |
| ESCROW | DEBIT | Platform Fee |
| PLATFORM_REVENUE | CREDIT | Platform Fee |

## Automated Settlement Worker

The `settlementWorker.js` runs as a background service, polling for `CREATED` transactions and moving them through the `invoiced` → `scheduled` → `settled` workflow. This ensures that the manual overhead of financial administration is eliminated.

## Invoicing & Documentation

- **Customer Invoices**: Generated automatically with `INV-C-*` prefixes.
- **Printer Invoices**: Generated automatically with `INV-P-*` prefixes.
- **Audit Trail**: Every transaction status change and external payout reference is logged in `settlement_events`.

## Payout Architecture

The system supports a modular payout provider model. While Phase 31 includes a simulated provider, the data structure is ready for integration with:
- **Stripe Connect**
- **Wise API**
- **Traditional SEPA/SWIFT Transfers**

## Governance & Oversight

Admins monitor the entire financial spectrum through the **Financial Operations** dashboard, which provides real-time visibility into:
- System-wide Gross Volume (GMV).
- Platform Revenue recognition.
- Ledger-level balance verification.
- Audit trails for every transaction.
