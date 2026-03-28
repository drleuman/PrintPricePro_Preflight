// notifications/templates/quota_80.js
module.exports = {
    subject: 'Usage Alert: 80% of your quota reached',
    textBody: 'Hi {{tenant_name}},\n\nYou have consumed 80% of your monthly job quota for your plan ({{plan_name}}). Current usage: {{usage_percent}}%.\n\nYou can manage your quota here: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2>Usage Alert</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>You have consumed <strong>80%</strong> of your monthly job quota for your plan ({{plan_name}}).</p>
            <p>Current usage: <strong>{{usage_percent}}%</strong></p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Manage Quota</a></p>
        </div>
    `
};
