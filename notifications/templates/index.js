// notifications/templates/index.js

const templates = {
    'quota_80': require('./quota_80'),
    'quota_100': require('./quota_100'),
    'plan_expiry_7d': require('./plan_expiry_7d'),
    'plan_expiry_1d': require('./plan_expiry_1d'),
    'plan_expired': require('./plan_expired'),
    'high_usage': require('./high_usage'),
    'churn_risk': require('./churn_risk')
};

function render(templateKey, data) {
    const template = templates[templateKey];
    if (!template) throw new Error(`Template not found: ${templateKey}`);

    const replaceVars = (str) => {
        return str.replace(/\{\{(.*?)\}\}/g, (match, key) => {
            return data[key.trim()] || match;
        });
    };

    return {
        subject: replaceVars(template.subject),
        text: replaceVars(template.textBody),
        html: replaceVars(template.htmlBody)
    };
}

module.exports = {
    render
};
