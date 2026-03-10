// notifications/templates/plan_expiry_7d.js
module.exports = {
    subject: 'Your plan expires in 7 days',
    textBody: 'Hi {{tenant_name}},\n\nYour current plan ({{plan_name}}) is set to expire on {{expiry_date}} (in 7 days). To avoid any interruption in service, please ensure your billing information is up to date or renew your plan.\n\nRenew here: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2>Subscription Expiring Soon</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>Your current plan ({{plan_name}}) is set to expire on <strong>{{expiry_date}}</strong> (in 7 days).</p>
            <p>To avoid any interruption in service, please ensure your billing information is up to date or renew your plan.</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Renew Subscription</a></p>
        </div>
    `
};
