// notifications/templates/high_usage.js
module.exports = {
    subject: 'High usage detected',
    textBody: 'Hi {{tenant_name}},\n\nWe have detected an unusually high volume of jobs in your account today. This is just a friendly heads-up to ensure your systems are performing as expected.\n\nView metrics: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2>Activity Spike Detected</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>We have detected an unusually high volume of jobs in your account today.</p>
            <p>This is just a friendly heads-up to ensure your systems are performing as expected.</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #64748b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Metrics</a></p>
        </div>
    `
};
