function humanizeFixCode(code) {
  const map = {
    'REBUILD_TRIMBOX': 'The final trim area was rebuilt from the page geometry.',
    'APPLY_BLEED': 'Bleed area was added or adjusted for print production.',
    'CONVERT_CMYK': 'Colors were converted to CMYK for print compatibility.',
    'INJECT_OUTPUT_INTENT': 'A print color profile was attached to the PDF.',
    'FLATTEN_FORMS': 'Interactive form fields were flattened into static print content.',
    'NORMALIZE_PAGE_BOXES': 'Page boxes were normalized for production consistency.',
    'CONVERT_GRAYSCALE': 'The file was converted to grayscale.',
    'REBUILD_300DPI': 'The file was rebuilt at 300 DPI for review/diagnostic purposes — this does not restore real image quality.',
    'BOOKLET_MODE': 'The file was prepared for booklet-style production.',
    'IMPOSE_BOOKLET': 'The file was prepared for booklet-style production.',
    'ADD_CROP_MARKS': 'Crop marks were added to indicate trim lines for the printer.',
    'REMOVE_REGISTRATION_MARKS': 'Registration marks were removed from the final output.',
    'NORMALIZE_OBJECT_STREAMS': 'Internal PDF object streams were normalized for compatibility and stability.',
    'REVOKE_FALSE_CERTIFICATION': 'A previously attached production certification was revoked because it no longer reflects the file\'s state.',
    'NORMALIZE_STANDARD_METADATA': 'Document metadata was normalized to standard print-production fields.',
    'STRIP_JAVASCRIPT': 'Embedded JavaScript was removed from the document for security and print-safety.',
    'FLATTEN_ANNOTATIONS': 'Annotations were flattened into static print content.',
    'GENERATE_STANDARD_VALIDATION_REPORT': 'A standard validation report was generated for diagnostic review (no file modification).',
    'NORMALIZE_OUTPUT_INTENT': 'The output intent / color profile reference was normalized for print compatibility.',
    'REMOVE_ACROFORM_ACTIONS': 'Potentially unsafe AcroForm actions were removed from the document.',
    'UPSCALE_LOW_RESOLUTION': 'Low-resolution images were detected. This cannot be reliably restored automatically — reupload a higher-resolution source if needed.',
    'REPAIR_JPEG_ARTIFACTS': 'JPEG compression artifacts were detected. Automatic repair is not reliable — reupload a cleaner source if possible.',
    'RASTER_TO_VECTOR': 'Rasterized artwork was detected where vector art is expected. Automatic vectorization is not reliable — reupload the original vector source.',
    'RECOVER_MISSING_GLYPHS': 'Missing font glyphs were detected. Automatic recovery is not reliable — reupload a file with the fonts embedded.',
    'SUBSTITUTE_FONTS': 'Non-embedded fonts were detected. Automatic substitution is not production-safe — an operator should review font handling.',
    'CONVERT_PDFX': 'A real PDF/X conversion was requested. This requires operator review and is not a guaranteed automatic conversion.',
    'CONVERT_PDFA': 'A real PDF/A conversion was requested. This requires operator review and is not a guaranteed automatic conversion.',
    'CORRECT_TAC': 'Total Area Coverage (TAC) correction was requested. Professional TAC correction requires operator review — this is not an automatic guarantee.'
  };
  return map[code] || `Correction ${code} was processed.`;
}

const NO_RELIABLE_AUTOFIX_CODES = new Set([
  'REBUILD_300DPI',
  'UPSCALE_LOW_RESOLUTION',
  'REPAIR_JPEG_ARTIFACTS',
  'RASTER_TO_VECTOR',
  'RECOVER_MISSING_GLYPHS',
  'SUBSTITUTE_FONTS',
  'CONVERT_PDFX',
  'CONVERT_PDFA',
  'CORRECT_TAC'
]);

function recommendedNextAction(code) {
  const reuploadCodes = new Set(['REBUILD_300DPI', 'UPSCALE_LOW_RESOLUTION', 'REPAIR_JPEG_ARTIFACTS', 'RASTER_TO_VECTOR', 'RECOVER_MISSING_GLYPHS']);
  const operatorReviewCodes = new Set(['SUBSTITUTE_FONTS', 'CONVERT_PDFX', 'CONVERT_PDFA', 'CORRECT_TAC']);
  if (reuploadCodes.has(code)) return 'Customer reupload recommended — provide a higher-quality source file.';
  if (operatorReviewCodes.has(code)) return 'Operator review required before this can move to production.';
  return null;
}

function buildClientChangeSummary(fixJobData) {
  const {
    jobId, status, productionCertified, requiresHumanReview,
    appliedFixes = [], skippedFixes = [], failedFixes = []
  } = fixJobData;

  const appliedChanges = (Array.isArray(appliedFixes) ? appliedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      description: f.description || null,
      requiresHumanReview: !!f.requiresHumanReview,
      destructiveFixRisk: f.destructiveFixRisk || null
    };
  }).filter(Boolean);

  const skippedChanges = (Array.isArray(skippedFixes) ? skippedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      reason: f.reason || null,
      requiresHumanReview: !!f.requiresHumanReview
    };
  }).filter(Boolean);

  const failedChanges = (Array.isArray(failedFixes) ? failedFixes : []).map(f => {
    if (!f) return null;
    return {
      code: f.code || f,
      label: humanizeFixCode(f.code || f),
      reason: f.reason || null
    };
  }).filter(Boolean);

  const reviewWarnings = [];

  for (const f of appliedChanges) {
    if (f.requiresHumanReview) reviewWarnings.push("This change requires visual review before production.");
    if (f.destructiveFixRisk === "HIGH") reviewWarnings.push("This change may alter the visual appearance of the file.");
    if (f.code === "CONVERT_CMYK") reviewWarnings.push("CMYK conversion can slightly change colors. Please review the output PDF.");
    if (f.code === "APPLY_BLEED" && fixJobData.strategy === "BOX_EXPANSION_ONLY") reviewWarnings.push("Bleed was applied by adjusting PDF page boxes; no new artwork was created beyond the page edge.");
  }

  if (skippedChanges.length > 0) reviewWarnings.push("Some requested corrections were not applied automatically.");
  if (failedChanges.length > 0) reviewWarnings.push("Some corrections failed and may require manual prepress intervention.");

  const uniqueWarnings = [...new Set(reviewWarnings)];

  const allChanges = [...appliedChanges, ...skippedChanges, ...failedChanges];
  const cannotFixAutomatically = [];
  const recommendedActions = [];
  const seenCodes = new Set();
  for (const f of allChanges) {
    if (!f || !NO_RELIABLE_AUTOFIX_CODES.has(f.code) || seenCodes.has(f.code)) continue;
    seenCodes.add(f.code);
    cannotFixAutomatically.push({ code: f.code, label: humanizeFixCode(f.code) });
    const action = recommendedNextAction(f.code);
    if (action) recommendedActions.push({ code: f.code, action });
  }

  let productionRecommendation = "Correction completed. Please verify the output before production.";
  if (productionCertified && !requiresHumanReview) {
    productionRecommendation = "Production certified. The corrected PDF can be used for print production.";
  } else if (requiresHumanReview) {
    productionRecommendation = "Review required before production use.";
  }

  return {
    title: "Client Change Summary",
    jobId,
    status,
    productionCertified,
    requiresHumanReview,
    plainLanguageSummary: "A summary of automatic corrections and findings.",
    whatChanged: appliedChanges,
    whatWasNotChanged: skippedChanges,
    whatRequiresReview: allChanges.filter(f => f && f.requiresHumanReview),
    whatCannotBeFixedAutomatically: cannotFixAutomatically,
    recommendedNextActions: recommendedActions,
    appliedChanges,
    skippedChanges,
    failedChanges,
    reviewWarnings: uniqueWarnings,
    productionRecommendation
  };
}

module.exports = { humanizeFixCode, recommendedNextAction, buildClientChangeSummary, NO_RELIABLE_AUTOFIX_CODES };
