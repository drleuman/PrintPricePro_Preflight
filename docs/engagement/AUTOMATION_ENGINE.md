# Engagement Automation Engine (Phase 21.3)

The Engagement Automation Engine converts platform signals into proactive engagement actions. It acts as an intelligence layer on top of the Notification Core.

## Signal Sources
The engine evaluates the following data points:
- **Quota Usage**: Current usage vs. monthly limits.
- **Plan Lifecycle**: Expiration dates and renewal status.
- **Activity Metrics**: Job volume metrics over 7-day and 30-day windows.

## Automation Rules

| Rule | Signal | Action | Frequency |
|------|--------|--------|-----------|
| Quota 80% | `usage >= 80%` | `quota.80` Notification | Once per 24h |
| Quota 100% | `usage >= 100%` | `quota.100` Notification | Once per 24h |
| Renewal 7d | `expires_in == 7d` | `plan.expiry_7d` | Once per cycle |
| Renewal 1d | `expires_in == 1d` | `plan.expiry_1d` | Once per cycle |
| Expiration | `today > expiry` | `plan.expired` | Once per cycle |
| High Usage | `usage >= 90%` | `tenant.high_usage` | Once per 24h |
| Churn Risk | `jobs_7d == 0 & jobs_30d > 5` | `tenant.churn_risk` | Once per 7d |

## Engagement Scoring
We use an **Activity Score** to detect significant drops in engagement:
`ActivityScore = (jobs_last_7d * 1.5) + (jobs_last_30d * 0.5)`

A sharp decrease in this score triggers the `tenant.churn_risk` signal for customer success follow-up.

## Administration
Admins can monitor automation logic through the **Engagement** tab in the Admin Dashboard.
- **Engagement Feed**: Real-time log of automation decisions.
- **Action Triggers**: Actions taken (e.g., `NOTIFY`).
- **Context**: Payload and variables used for the trigger.

## Safety & Deduplication
To prevent spam, the engine uses:
1. **Internal Deduplication**: Decisions are recorded in `engagement_events` and checked before re-triggering within a window (usually 24h).
2. **Notification Core Dedupe**: The notifier applies its own secondary deterministic deduplication keys.
3. **Tenant Preferences**: Rules respect `tenant_notification_preferences`.
