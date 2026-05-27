const { resolveArtifactName } = require('../app/services/preflightNormalizer');

function runTest(name, expected, actual) {
  const match = JSON.stringify(expected) === JSON.stringify(actual);
  if (match) {
    console.log(`✅ [PASS] ${name}`);
  } else {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`Expected:`, expected);
    console.error(`Actual:`, actual);
    process.exitCode = 1;
  }
}

console.log("=== Running Phase 39.1.10 Smoke Test ===");

// Scenario 1: Exact match in artifacts
const report1 = {
  artifacts: {
    fix_audit: "fix_audit.json",
    fixed_pdf: "fixed.pdf",
    final_fixed_pdf: "fixed.pdf",
    review_pdf: "fixed.pdf"
  },
  artifactList: [
    { type: "fix_audit", name: "fix_audit.json" },
    { type: "fixed_pdf", name: "fixed.pdf" },
    { type: "final_fixed_pdf", name: "fixed.pdf" },
    { type: "review_pdf", name: "fixed.pdf" }
  ],
  productionCertified: false,
  requiresHumanReview: true
};

runTest(
  "resolveArtifactName resolves review_pdf correctly",
  {
    requestedKey: "review_pdf",
    resolvedKey: "review_pdf",
    filename: "fixed.pdf",
    source: "artifacts"
  },
  resolveArtifactName(report1, "review_pdf")
);

// Scenario 2: review_pdf missing, should fallback to final_fixed_pdf/fixed_pdf
const report2 = {
  artifacts: {
    fixed_pdf: "fallback.pdf"
  },
  productionCertified: false,
  requiresHumanReview: true
};

runTest(
  "review_pdf fallback to fixed_pdf when review_pdf is missing",
  {
    requestedKey: "review_pdf",
    resolvedKey: "fixed_pdf",
    filename: "fallback.pdf",
    source: "artifacts"
  },
  resolveArtifactName(report2, "review_pdf")
);

// Scenario 3: review_pdf must not fallback to certified_pdf when requiresHumanReview=true
const report3 = {
  artifacts: {
    certified_pdf: "certified.pdf"
  },
  productionCertified: false,
  requiresHumanReview: true
};

runTest(
  "review_pdf must not fallback to certified_pdf",
  null,
  resolveArtifactName(report3, "review_pdf")
);

// Scenario 4: certified_pdf still resolves for productionCertified=true
const report4 = {
  artifacts: {
    certified_pdf: "certified_output.pdf"
  },
  productionCertified: true,
  requiresHumanReview: false
};

runTest(
  "certified_pdf still resolves for productionCertified=true",
  {
    requestedKey: "certified_pdf",
    resolvedKey: "certified_pdf",
    filename: "certified_output.pdf",
    source: "artifacts"
  },
  resolveArtifactName(report4, "certified_pdf")
);

// Scenario 5: unknown artifact returns null
runTest(
  "unknown artifact returns null",
  null,
  resolveArtifactName(report1, "unknown_pdf")
);

console.log("=== Smoke Test Complete ===");
