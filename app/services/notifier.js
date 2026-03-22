/**
 * Stub for missing notifier service.
 */
module.exports = {
    notifyThreshold: async (tenantId, level, current, limit) => {
        console.log(`[STUB] Notification: Tenant=${tenantId} reached ${level}% (${current}/${limit})`);
        return true;
    }
};

