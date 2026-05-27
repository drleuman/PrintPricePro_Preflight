const { normalizeAutofixJob } = require('../app/services/preflightNormalizer');

const mockJob = {
  id: 'fix_123',
  type: 'AUTOFIX',
  meta: { jobId: 'fix_123' },
  status: 'COMPLETED',
  result: {
    artifacts: {
      final_fixed_pdf: 'http://example.com/fixed.pdf',
      certified_pdf: 'http://example.com/certified.pdf'
    },
    artifactList: [
      { type: 'final_fixed_pdf', name: 'http://example.com/fixed.pdf' },
      { type: 'certified_pdf', name: 'http://example.com/certified.pdf' }
    ],
    applied_fixes: [
      {
        code: 'CONVERT_CMYK',
        destructiveFixRisk: 'HIGH'
      }
    ],
    artifact_delta: {
      original_size_bytes: 18269833,
      fixed_size_bytes: 6733078,
      size_delta_percent: -63.14
    }
  }
};

const result = normalizeAutofixJob(mockJob, null);

console.log("Status:", result.status);
console.log("Production Certified:", result.productionCertified);
console.log("Requires Human Review:", result.requiresHumanReview);
console.log("Destructive Risk:", result.destructiveRiskSummary);
console.log("Artifact Delta:", result.artifact_delta);
console.log("Artifacts:", result.artifacts);
console.log("Artifact List:", result.artifactList);

if (result.artifacts.certified_pdf) {
    console.error("ERROR: certified_pdf should be stripped!");
    process.exit(1);
}

if (!result.artifacts.review_pdf) {
    console.error("ERROR: review_pdf should be exposed!");
    process.exit(1);
}

console.log("SUCCESS!");
