const preflightNormalizer = require('../app/services/preflightNormalizer');

async function runTest() {
  const fixture = {
    type: "AUTOFIX",
    status: "AUTOFIX_REVIEW_REQUIRED",
    applied_fixes: [],
    skipped_fixes: [
      {
        code: "CONVERT_CMYK",
        status: "SKIPPED",
        reason: "Destructive color conversion requires explicit review mode.",
        destructiveFixRisk: "HIGH",
        requires_human_review: true
      }
    ],
    failed_fixes: [],
    artifacts: {
      final_fixed_pdf: "fixed.pdf",
      fixed_pdf: "fixed.pdf",
      review_pdf: "fixed.pdf",
      certified_pdf: "certified.pdf",
      fix_audit: "fix_audit.json"
    }
  };

  console.log("Input Fixture:", JSON.stringify(fixture, null, 2));

  const result = preflightNormalizer.normalizeAutofixResultState(fixture);
  console.log("\nNormalized Result:", JSON.stringify(result, null, 2));

  const isPass = 
    result.status === "AUTOFIX_REVIEW_REQUIRED" &&
    result.isFailedFix === false &&
    result.technicallyFixed === false &&
    result.productionCertified === false &&
    result.requiresHumanReview === true &&
    result.hasFinalFixedPdf === false &&
    result.hasFixedArtifact === false &&
    result.hasReviewArtifact === false &&
    result.artifacts?.final_fixed_pdf === undefined &&
    result.artifacts?.fixed_pdf === undefined &&
    result.artifacts?.review_pdf === undefined &&
    result.artifacts?.certified_pdf === undefined &&
    result.artifacts?.fix_audit === "fix_audit.json";

  if (isPass) {
    console.log("\n✅ SMOKE TEST PASSED: AUTOFIX_REVIEW_REQUIRED properly purged artifacts.");
    process.exit(0);
  } else {
    console.error("\n❌ SMOKE TEST FAILED: Normalization did not match expectations.");
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
