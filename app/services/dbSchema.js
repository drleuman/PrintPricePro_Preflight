/**
 * Stub for missing dbSchema service.
 */
module.exports = {
    initSchema: async () => {
        console.log('[STUB] initSchema called - skipping actual migration');
        return true;
    }
};

