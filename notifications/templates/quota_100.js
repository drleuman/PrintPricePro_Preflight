// notifications/templates/quota_100.js
module.exports = {
    subject: 'CRITICAL: 100% of your quota reached',
    textBody: 'Hi {{tenant_name}},\n\nURGENT: You have consumed 100% of your monthly job quota for your plan ({{plan_name}}). Processing of new jobs may be paused until your quota resets or you upgrade your plan.\n\nManage your account here: {{dashboard_link}}',
    htmlBody: `
        <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #dc2626;">CRITICAL: Quota Limit Reached</h2>
            <p>Hi <strong>{{tenant_name}}</strong>,</p>
            <p>You have consumed <strong>100%</strong> of your monthly job quota for your plan ({{plan_name}}).</p>
            <p style="color: #dc2626; font-weight: bold;">Processing of new jobs may be paused until your quota resets or you upgrade your plan.</p>
            <hr />
            <p><a href="{{dashboard_link}}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Upgrade / Manage Plan</a></p>
        </div>
    `
};
