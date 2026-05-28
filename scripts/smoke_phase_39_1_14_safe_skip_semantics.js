const preflightNormalizer = require('../app/services/preflightNormalizer');

async function runTest() {
  const fixture = {
    type: "AUTOFIX",
    status: "NO_CHANGE",
    applied_fixes: [],
    failed_fixes: [],
    skipped_fixes: [
      {
        code: "CONVERT_CMYK",
        status: "SKIPPED",
        reason: "Destructive color conversion requires explicit review mode.",
        destructiveFixRisk: "HIGH",
        requires_human_review: true
      }
    ],
    artifacts: {}
  };

  console.log("Input Fixture:", JSON.stringify(fixture, null, 2));

  const result = preflightNormalizer.normalizeAutofixResultState(fixture);
  console.log("\nNormalized Result:", JSON.stringify(result, null, 2));

  const isPass = 
    result.status === "AUTOFIX_REVIEW_REQUIRED" &&
    result.isFailedFix === false &&
    result.requiresHumanReview === true &&
    result.productionCertified === false &&
    result.technicallyFixed === false &&
    !result.artifacts?.fixed_pdf &&
    !result.artifacts?.review_pdf &&
    result.reviewReasons?.includes("CONVERT_CMYK");

  if (isPass) {
    console.log("\n✅ SMOKE TEST PASSED: AUTOFIX_REVIEW_REQUIRED semantics correctly mapped.");
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
