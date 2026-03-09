'use strict';

/**
 * services/policyEngine.js
 * 
 * Policy Engine — loads, validates, and resolves print policies for each job.
 * Policies are JSON files in /policies/ and control all limits, rules, and fix behavior.
 */

const path = require('path');
/**
 * @project PrintPrice Pro - Policy & Rule Engine
 * @author Manuel Enrique Morales (https://manuelenriquemorales.com/)
 * @social https://x.com/manuel_emorales | https://www.linkedin.com/in/manuelenriquemorales/
 */
const fs = require('fs');

const POLICIES_DIR = path.join(__dirname, '../policies');
const REGISTRY_PATH = path.join(POLICIES_DIR, 'registry.json');

// Cache loaded policies in memory
const _policyCache = new Map();
let _registry = null;

/**
 * Load the policy registry.
 */
function getRegistry() {
    if (_registry) return _registry;
    try {
        _registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch (e) {
        console.error('[POLICY] Failed to load registry.json:', e.message);
        _registry = { policies: [], default: 'OFFSET_CMYK_STRICT' };
    }
    return _registry;
}

/**
 * Load a policy by slug. Returns null if not found.
 * @param {string} slug 
 * @returns {object|null}
 */
function loadPolicy(slug) {
    if (!slug) slug = getRegistry().default || 'OFFSET_CMYK_STRICT';

    if (_policyCache.has(slug)) return _policyCache.get(slug);

    const filePath = path.join(POLICIES_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) {
        console.warn(`[POLICY] Unknown policy slug: "${slug}", falling back to OFFSET_CMYK_STRICT`);
        return loadPolicy('OFFSET_CMYK_STRICT');
    }

    try {
        const policy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        _invalidateAfter(slug, 60000); // Re-read from disk after 1 min (hot-reload)
        _policyCache.set(slug, policy);
        return policy;
    } catch (e) {
        console.error(`[POLICY] Failed to parse ${slug}.json:`, e.message);
        return getDefaultPolicy();
    }
}

function _invalidateAfter(slug, ms) {
    setTimeout(() => _policyCache.delete(slug), ms).unref();
}

/**
 * Returns a safe default policy (OFFSET_CMYK_STRICT) as hardcoded fallback.
 */
function getDefaultPolicy() {
    return {
        slug: 'OFFSET_CMYK_STRICT',
        name: 'Offset CMYK Strict (FOGRA51)',
        color: {
            mode: 'cmyk',
            icc_profile: 'PSO_Coated_v3.icc',
            convert_rgb: true,
            tac_limit: 300,
            allow_spot_colors: true,
            spot_color_whitelist: ['CutContour', 'Varnish', 'SafetyPerforation'],
            require_output_intent: true,
            flatten_transparency: true,
            render_intent: 1
        },
        document: {
            bleed_mm_required: 3,
            min_resolution_dpi: 200,
            max_pages: 1000,
            max_file_mb: 500,
            max_spot_colors: 0
        },
        processing: {
            job_timeout_ms: 300000,
            gs_concurrency: 2,
            dpi_rebuild: 300
        },
        autofix: {
            actions: ['convert_cmyk', 'flatten_transparency', 'add_bleed'],
            allow_lossy: false
        },
        checks: {
            error_on_rgb: true,
            error_on_missing_bleed: true,
            error_on_tac_exceeded: true,
            warn_on_low_resolution: true,
            warn_on_spot_colors: false,
            warn_on_type3_fonts: true
        }
    };
}

/**
 * Resolve the ICC profile path for a policy.
 * @param {object} policy
 * @returns {string|null}
 */
function resolveIccPath(policy) {
    const iccDir = path.join(__dirname, '../icc-profiles');
    const iccFile = policy?.color?.icc_profile;
    if (!iccFile) return null;

    const fullPath = path.join(iccDir, iccFile);
    if (!fs.existsSync(fullPath)) {
        // Fallback to FOGRA39 for legacy support
        const legacy = path.join(iccDir, 'CoatedFOGRA39.icc');
        if (fs.existsSync(legacy)) {
            console.warn(`[POLICY] ICC profile "${iccFile}" not found, falling back to CoatedFOGRA39`);
            return legacy;
        }
        console.warn(`[POLICY] No ICC profile found for policy "${policy.slug}"`);
        return null;
    }
    return fullPath;
}

/**
 * Validate a PDF report against a policy.
 * Adds policy violation issues to report.policy_violations.
 * @param {object} report - Preflight report from deterministicService
 * @param {object} policy
 * @param {object} meta - { pageCount, fileSizeMb }
 * @returns {object} { violations: [], warnings: [] }
 */
function validateAgainstPolicy(report, policy, meta = {}) {
    const violations = [];
    const warnings = [];

    const doc = policy.document || {};
    const checks = policy.checks || {};
    const color = policy.color || {};

    // -- File size check --
    if (doc.max_file_mb && meta.fileSizeMb > doc.max_file_mb) {
        violations.push({
            rule: 'max_file_mb',
            message: `File exceeds maximum allowed size: ${meta.fileSizeMb.toFixed(1)}MB > ${doc.max_file_mb}MB`,
            severity: 'ERROR'
        });
    }

    // -- Page count check --
    if (doc.max_pages && meta.pageCount > doc.max_pages) {
        violations.push({
            rule: 'max_pages',
            message: `Document exceeds maximum pages: ${meta.pageCount} > ${doc.max_pages}`,
            severity: 'ERROR'
        });
    }

    // -- RGB check --
    if (checks.error_on_rgb && report?.prepress_summary?.has_rgb) {
        violations.push({
            rule: 'error_on_rgb',
            message: `Policy "${policy.slug}" requires CMYK only — RGB content detected`,
            severity: 'ERROR'
        });
    }

    // -- TAC check --
    if (checks.error_on_tac_exceeded) {
        const maxTac = color.tac_limit || 300;
        const reportedTac = report?.prepress_summary?.tac_summary?.max_tac;
        if (reportedTac && reportedTac > maxTac) {
            violations.push({
                rule: 'tac_limit',
                message: `Total Area Coverage ${reportedTac}% > policy limit ${maxTac}%`,
                severity: 'ERROR'
            });
        }
    }

    // -- Bleed check --
    if (checks.error_on_missing_bleed && doc.bleed_mm_required > 0) {
        const hasBleed = report?.prepress_summary?.has_bleed;
        const bleedMm = report?.prepress_summary?.bleed_mm || 0;
        if (!hasBleed || bleedMm < doc.bleed_mm_required) {
            violations.push({
                rule: 'bleed_mm_required',
                message: `Policy requires ${doc.bleed_mm_required}mm bleed — found ${bleedMm.toFixed(1)}mm`,
                severity: 'ERROR'
            });
        }
    }

    // -- Spot color limit --
    if (checks.error_on_too_many_spots && doc.max_spot_colors > 0) {
        const spotCount = report?.prepress_summary?.spot_summary?.spot_count || 0;
        if (spotCount > doc.max_spot_colors) {
            violations.push({
                rule: 'max_spot_colors',
                message: `Policy allows max ${doc.max_spot_colors} spot colors — found ${spotCount}`,
                severity: 'ERROR'
            });
        }
    }

    // -- Warnings --
    if (checks.warn_on_low_resolution) {
        const lowRes = report?.prepress_summary?.has_low_resolution;
        if (lowRes) {
            warnings.push({
                rule: 'min_resolution_dpi',
                message: `Images below recommended ${doc.min_resolution_dpi} DPI detected`,
                severity: 'WARNING'
            });
        }
    }

    return { violations, warnings };
}

/**
 * Get the ordered autofix action list for a policy.
 * @param {object} policy
 * @returns {string[]}
 */
function getAutoFixActions(policy) {
    return policy?.autofix?.actions || ['convert_cmyk', 'add_bleed'];
}

/**
 * List all available policies from registry.
 */
function listPolicies() {
    return getRegistry().policies || [];
}

/**
 * Evaluate technical rules from analysis results against a policy.
 * @param {object} results - Analysis results from deterministicService
 * @param {object} policy
 * @returns {object[]} - Array of findings
 */
function evaluateTechnicalRules(results, policy) {
    const findings = [];
    const { info, fonts } = results;
    const checks = policy.checks || {};
    const doc = policy.document || {};

    // 1. Font Findings
    if (fonts && fonts.length > 0) {
        const notEmbedded = fonts.filter(f => !f.emb);
        if (notEmbedded.length > 0) {
            findings.push({
                id: 'fonts-not-embedded',
                severity: 'ERROR',
                evidence: {
                    source: 'pdf_struct',
                    details: `Found ${notEmbedded.length} fonts not embedded: ${notEmbedded.map(f => f.name).join(', ')}`
                }
            });
        }

        const type3 = fonts.filter(f => f.type === 'Type 3');
        if (type3.length > 0 && checks.warn_on_type3_fonts) {
            findings.push({
                id: 'type3-fonts-present',
                severity: 'WARNING',
                evidence: {
                    source: 'pdf_struct',
                    details: `Found Type 3 (bitmap) fonts: ${type3.map(f => f.name).join(', ')}`
                }
            });
        }
    }

    // 2. Geometry Findings
    if (info && info.pages > 0) {
        const requiredBleed = doc.bleed_mm_required || 0;
        if (requiredBleed > 0 && !info.hasBleedBox) {
            findings.push({
                id: 'missing-bleed-info',
                severity: checks.error_on_missing_bleed ? 'ERROR' : 'WARNING',
                evidence: {
                    source: 'pdf_struct',
                    details: `Policy requires ${requiredBleed}mm bleed, but BleedBox is missing.`
                }
            });
        }
    }

    // 3. Color Findings
    if (results.separations && results.separations.hasSpots) {
        const allowSpots = policy.color?.allow_spot_colors;
        findings.push({
            id: 'spot-color-detected',
            severity: allowSpots ? 'INFO' : 'WARNING',
            evidence: {
                source: 'rip_probe',
                details: `Found ${results.separations.spotColors.length} spot colors: ${results.separations.spotColors.join(', ')}`
            }
        });
    }

    if (policy.color?.require_output_intent && !results.hasOutputIntent) {
        findings.push({
            id: 'missing-output-intent',
            severity: 'WARNING',
            evidence: {
                source: 'pdf_dictionary',
                details: 'Policy requires OutputIntent, but none found.'
            }
        });
    }

    // 4. Integrated Heuristic Findings
    const heuristicService = require('./heuristicService');

    if (results.imageHeuristics && results.imageHeuristics.findings) {
        findings.push(...results.imageHeuristics.findings.map(f => ({
            ...f,
            evidence: { source: 'image_probe', details: f.details }
        })));
    }

    const editRisk = heuristicService.detectVectorTextRisk(info, fonts);
    if (editRisk.length > 0) {
        findings.push(...editRisk.map(f => ({
            id: f.id,
            severity: f.severity.toUpperCase(),
            type: 'heuristic',
            evidence: { source: 'font_heuristic', details: f.details }
        })));
    }

    const intents = heuristicService.classifyEditionIntent(info);
    intents.forEach(intent => {
        findings.push({
            id: intent.id,
            severity: 'INFO',
            type: 'heuristic',
            confidence: intent.confidence,
            evidence: {
                source: 'layout_heuristic',
                details: intent.user_message
            }
        });
    });

    return findings;
}

module.exports = {
    loadPolicy,
    resolveIccPath,
    validateAgainstPolicy,
    getAutoFixActions,
    getDefaultPolicy,
    listPolicies,
    getRegistry,
    evaluateTechnicalRules
};
