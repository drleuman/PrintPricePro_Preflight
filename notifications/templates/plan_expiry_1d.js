// notifications/templates/plan_expiry_1d.js
module.exports = {
    subject: 'URGENT: Your plan expires tomorrow',
    textBody: 'Hi {{tenant_name}},\n\nYour current plan ({{plan_name}}) will expire tomorrow, on {{expiry_date}}. Act now to prevent service disruption.\n\nRenew immediately: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #ea580c;">Action Required: Expiration Tomorrow</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>Your current plan ({{plan_name}}) will expire <strong>tomorrow</strong>, on <strong>{{expiry_date}}</strong>.</p>
            <p style="color: #ea580c; font-weight: bold;">Act now to prevent service disruption.</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Renew Immediately</a></p>
        </div>
    `
};
