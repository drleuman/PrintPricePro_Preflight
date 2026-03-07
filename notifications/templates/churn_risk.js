// notifications/templates/churn_risk.js
module.exports = {
    subject: 'Engagement Alert',
    textBody: 'Hi {{tenant_name}},\n\nWe noticed your activity has decreased recently. We are here to help you get the most out of PrintPrice. Would you like to schedule a success call?\n\nContact Support: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2>How can we help?</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>We noticed your activity has decreased recently. We are here to help you get the most out of PrintPrice.</p>
            <p>Would you like to schedule a success call to optimize your workflows?</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Schedule Success Call</a></p>
        </div>
    `
};
