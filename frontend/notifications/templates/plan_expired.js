// notifications/templates/plan_expired.js
module.exports = {
    subject: 'Your plan has expired',
    textBody: 'Hi {{tenant_name}},\n\nYour current plan ({{plan_name}}) has expired as of {{expiry_date}}. Your access to core features has been restricted. Please renew your subscription to restore full access.\n\nRenew now: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #dc2626;">Subscription Expired</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>Your current plan ({{plan_name}}) has expired as of <strong>{{expiry_date}}</strong>.</p>
            <p style="color: #dc2626; font-weight: bold;">Your access to core features has been restricted.</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restore Access</a></p>
        </div>
    `
};
