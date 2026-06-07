'use strict';

/**
 * Phase APP-40.1 — Capability Contract Alignment.
 *
 * The APP must stop guessing which fixes the engine supports. This route exposes
 * a normalized capability contract for the frontend (`usePreflightCapabilities`)
 * and the BFF's own fix-request gating.
 *
 * Source of truth: PrintPrice OS Preflight Service `GET /api/preflight/capabilities`.
 * If that endpoint is not yet available, a temporary local fallback is served —
 * clearly marked so it is not mistaken for the operating system's contract.
 */

const express = require('express');
const identityService = require('../services/identityService');
const { pposRequest } = require('../services/apiClient');

const router = express.Router();

const CAPABILITY_VERSION = 'phase-10-intelligence-layer';

// TEMPORARY FALLBACK ONLY.
// Source of truth must be ppos-preflight-service capabilities contract.
// Remove this list once GET {PPOS_PREFLIGHT_SERVICE_URL}/api/preflight/capabilities is live in production.
const FALLBACK_CAPABILITIES = [
  { code: 'REBUILD_TRIMBOX', label: 'Rebuild TrimBox', category: 'GEOMETRY', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'APPLY_BLEED', label: 'Apply bleed', category: 'GEOMETRY', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'NORMALIZE_PAGE_BOXES', label: 'Normalize page boxes', category: 'GEOMETRY', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'ADD_CROP_MARKS', label: 'Add crop marks', category: 'MARKS', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'REMOVE_REGISTRATION_MARKS', label: 'Remove registration marks', category: 'MARKS', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'CONVERT_CMYK', label: 'Convert RGB to CMYK', category: 'COLOR', implemented: true, autofixable: true, requires_human_review: true, production_safe: false, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'FIXED_REVIEW_REQUIRED' },
  { code: 'CONVERT_GRAYSCALE', label: 'Convert to grayscale', category: 'COLOR', implemented: true, autofixable: true, requires_human_review: true, production_safe: false, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'FIXED_REVIEW_REQUIRED' },
  { code: 'INJECT_OUTPUT_INTENT', label: 'Inject output intent', category: 'COLOR', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'NORMALIZE_OUTPUT_INTENT', label: 'Normalize output intent', category: 'COLOR', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'FLATTEN_FORMS', label: 'Flatten interactive forms', category: 'STRUCTURE', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'FLATTEN_ANNOTATIONS', label: 'Flatten annotations', category: 'STRUCTURE', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'NORMALIZE_OBJECT_STREAMS', label: 'Normalize object streams', category: 'STRUCTURE', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'NORMALIZE_STANDARD_METADATA', label: 'Normalize standard metadata', category: 'METADATA', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'STRIP_JAVASCRIPT', label: 'Strip embedded JavaScript', category: 'SECURITY', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'REMOVE_ACROFORM_ACTIONS', label: 'Remove AcroForm actions', category: 'SECURITY', implemented: true, autofixable: true, requires_human_review: false, production_safe: true, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'FIXED_SAFE' },
  { code: 'REVOKE_FALSE_CERTIFICATION', label: 'Revoke false certification', category: 'CERTIFICATION', implemented: true, autofixable: true, requires_human_review: true, production_safe: false, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'FIXED_REVIEW_REQUIRED' },
  { code: 'GENERATE_STANDARD_VALIDATION_REPORT', label: 'Generate standard validation report', category: 'REPORTING', implemented: true, autofixable: false, requires_human_review: false, production_safe: true, diagnostic_only: true, customer_reupload_recommended: false, operator_review_required: false, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'BOOKLET_MODE', label: 'Booklet mode', category: 'IMPOSITION', implemented: true, autofixable: true, requires_human_review: true, production_safe: false, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'FIXED_REVIEW_REQUIRED' },
  { code: 'IMPOSE_BOOKLET', label: 'Impose booklet', category: 'IMPOSITION', implemented: true, autofixable: true, requires_human_review: true, production_safe: false, diagnostic_only: false, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'FIXED_REVIEW_REQUIRED' },
  // The following are knowingly NOT reliable autofixes — never present them as such.
  { code: 'REBUILD_300DPI', label: 'Rebuild at 300 DPI (review/diagnostic only)', category: 'IMAGE', implemented: true, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'UPSCALE_LOW_RESOLUTION', label: 'Low-resolution upscaling (diagnostic only)', category: 'IMAGE', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'REPAIR_JPEG_ARTIFACTS', label: 'JPEG artifact repair (diagnostic only)', category: 'IMAGE', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'RASTER_TO_VECTOR', label: 'Raster-to-vector conversion (diagnostic only)', category: 'IMAGE', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'RECOVER_MISSING_GLYPHS', label: 'Missing glyph recovery (diagnostic only)', category: 'FONTS', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'SUBSTITUTE_FONTS', label: 'Automatic font substitution (diagnostic only)', category: 'FONTS', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: true, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'CONVERT_PDFX', label: 'Real PDF/X conversion (diagnostic only)', category: 'STANDARDS', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'CONVERT_PDFA', label: 'Real PDF/A conversion (diagnostic only)', category: 'STANDARDS', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
  { code: 'CORRECT_TAC', label: 'Professional TAC correction (diagnostic only)', category: 'COLOR', implemented: false, autofixable: false, requires_human_review: true, production_safe: false, diagnostic_only: true, customer_reupload_recommended: false, operator_review_required: true, trust_level: 'DIAGNOSTIC_ONLY' },
];

function buildFallbackContract() {
  return {
    ok: true,
    version: CAPABILITY_VERSION,
    source: 'APP_FALLBACK',
    // TEMPORARY FALLBACK ONLY. Source of truth must be ppos-preflight-service capabilities contract.
    fallbackMode: true,
    capabilities: FALLBACK_CAPABILITIES,
  };
}

/**
 * GET /api/v2/preflight/capabilities
 * Normalized capability contract consumed by `usePreflightCapabilities` and the
 * fix-request whitelist (`fixCapabilityGate.ts`).
 */
router.get('/capabilities', async (req, res) => {
  try {
    const authHeaders = identityService.getAuthHeaders(req.auth || req.user || {});
    const response = await pposRequest('/api/preflight/capabilities', {
      method: 'GET',
      headers: { Authorization: authHeaders.Authorization },
    });

    if (response.ok) {
      const data = await response.json();
      const capabilities = Array.isArray(data?.capabilities) ? data.capabilities : null;

      if (capabilities) {
        return res.json({
          ok: true,
          version: data.version || CAPABILITY_VERSION,
          source: 'PPOS_PREFLIGHT_SERVICE',
          fallbackMode: false,
          capabilities,
        });
      }
    }

    console.warn('[CAPABILITIES][FALLBACK] PPOS capability contract unavailable — serving temporary local fallback');
    return res.json(buildFallbackContract());
  } catch (error) {
    console.warn('[CAPABILITIES][FALLBACK]', { reason: error.message });
    return res.json(buildFallbackContract());
  }
});

module.exports = router;
