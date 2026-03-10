/**
 * Service to compute deltas between two preflight reports (Before vs After).
 */
class DeltaService {
    /**
     * Computes the delta between an initial report and a follow-up (fixed) report.
     */
    computeDelta(before, after) {
        const delta = {
            fixed_count: 0,
            remaining_count: 0,
            new_issues_count: 0,
            resolved_ids: [],
            metrics: {
                pageCount: [before.document.pageCount, after.document.pageCount],
                severity_distribution: {
                    before: this.getSeverityCounts(before.findings),
                    after: this.getSeverityCounts(after.findings)
                }
            }
        };

        const beforeIds = new Set(before.findings.map(f => f.id));
        const afterIds = new Set(after.findings.map(f => f.id));

        // Resolved issues: present in 'before', missing in 'after'
        delta.resolved_ids = [...beforeIds].filter(id => !afterIds.has(id));
        delta.fixed_count = delta.resolved_ids.length;

        // Remaining issues: present in both
        delta.remaining_count = [...afterIds].filter(id => beforeIds.has(id)).length;

        // New issues: present only in 'after' (regression scan)
        delta.new_issues_count = [...afterIds].filter(id => !beforeIds.has(id)).length;

        return delta;
    }

    getSeverityCounts(findings) {
        const counts = { fatal: 0, error: 0, warning: 0, info: 0 };
        findings.forEach(f => {
            if (counts[f.severity] !== undefined) {
                counts[f.severity]++;
            }
        });
        return counts;
    }
}

module.exports = new DeltaService();
