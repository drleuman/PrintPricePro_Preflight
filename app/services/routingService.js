/**
 * Stub for missing routingService.
 */
module.exports = {
    recommendRoute: async (jobId, options) => {
        console.log(`[STUB] recommendRoute called for Job=${jobId}`, options);
        return {
            recommended_printer: 'STUB_PRINTER',
            confidence: 0.99,
            estimated_cost: 100
        };
    }
};

