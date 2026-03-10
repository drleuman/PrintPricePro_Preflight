// services/notificationRegistry.js

const EVENTS = {
    'quota.80': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 24,
        subject: 'Usage Alert: 80% of your quota reached',
        description: 'Tenant has consumed 80% of their monthly job quota.'
    },
    'quota.100': {
        channel: 'email',
        severity: 'critical',
        dedupe_window_hours: 24,
        subject: 'CRITICAL: 100% of your quota reached',
        description: 'Tenant has consumed 100% of their monthly job quota.'
    },
    'plan.expiry_7d': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168, // 7 days
        subject: 'Your plan expires in 7 days',
        description: 'Subscription is approaching expiration (7 days remaining).'
    },
    'plan.expiry_1d': {
        channel: 'email',
        severity: 'critical',
        dedupe_window_hours: 24,
        subject: 'URGENT: Your plan expires tomorrow',
        description: 'Subscription expires in 24 hours.'
    },
    'plan.expired': {
        channel: 'email',
        severity: 'critical',
        dedupe_window_hours: 24,
        subject: 'Your plan has expired',
        description: 'Subscription has expired and services may be limited.'
    },
    'tenant.high_usage': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 12,
        subject: 'High usage detected',
        description: 'Tenant is experiencing unusually high job volume.'
    },
    'tenant.churn_risk': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'Engagement Alert',
        description: 'Tenant shows signs of potential churn (low activity).'
    },
    'cs.outreach_1': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'We haven\'t seen you lately',
        description: 'CS Outreach Step 1: Re-engagement'
    },
    'cs.outreach_2': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'Quick tips to optimize your production',
        description: 'CS Outreach Step 2: Value delivery'
    },
    'cs.outreach_3': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'Can we help you with anything?',
        description: 'CS Outreach Step 3: Direct contact'
    },
    'cs.upsell_intro': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'You\'re growing fast!',
        description: 'CS Upsell Step 1: Growth recognition'
    },
    'cs.upsell_proposal': {
        channel: 'email',
        severity: 'warning',
        dedupe_window_hours: 168,
        subject: 'Scaling your production with PrintPrice',
        description: 'CS Upsell Step 2: Plan upgrade proposal'
    },
    'cs.renewal_reminder': {
        channel: 'email',
        severity: 'critical',
        dedupe_window_hours: 168,
        subject: 'Time to renew your PrintPrice plan',
        description: 'CS Renewal Step: Proactive renewal outreach'
    }
};

module.exports = {
    EVENTS,
    getEventConfig: (type) => EVENTS[type] || null
};
