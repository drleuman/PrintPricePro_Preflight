const spineCalculator = require('./spineCalculator');
const fs = require('fs');
const path = require('path');

/**
 * Binding Intelligence Service
 * 
 * Assesses physical manufacturability by aligning PDF facts 
 * with production specifications (BPE).
 */
class BindingIntelligenceService {
    constructor() {
        this.rulesPath = path.join(__dirname, '../registry/binding_rules.json');
        this.rules = this.loadRules();
    }

    loadRules() {
        try {
            const data = fs.readFileSync(this.rulesPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('[BindingIntelligence] Failed to load rules:', error);
            return { policy: {}, binding_types: {} };
        }
    }

    /**
     * Assesses physical feasibility and alignment with specs.
     * 
     * @param {Object} technicalFacts PDF technical signals.
     * @param {Object} productionIntent Intent detector result.
     * @param {Object} productionSpecs Normalized BPE specs.
     */
    assess(technicalFacts, productionIntent, productionSpecs = {}) {
        const pdfPageCount = technicalFacts.info?.pages || 0;
        const policy = this.rules.policy || {};

        // 1. Determine Target Binding (Priority: Specs > Intent)
        const bindingType = productionSpecs.bindingType || this.mapIntentToBinding(productionIntent.primary_intent);
        const bindingSource = productionSpecs.bindingType ? 'explicit_spec' : 'intent_inference';

        const limits = this.rules.binding_types[bindingType];

        // Safety Guard
        if (!limits) {
            return this.createErrorResponse(bindingType, `No binding rule found for ${bindingType}`);
        }

        const evidence = [];
        const findings = [];

        // 2. Physical Cross-Checks (PDF vs Specs) - Applying Mismatch Policy

        // Check A: Page Count Mismatch
        if (productionSpecs.pageCount > 0) {
            const delta = Math.abs(pdfPageCount - productionSpecs.pageCount);
            if (delta > (policy.mismatch_severities?.page_count_delta_threshold || 0)) {
                findings.push({
                    id: 'PAGE_COUNT_MISMATCH',
                    severity: policy.mismatch_severities?.page_count_mismatch || 'warning',
                    scope: 'physical',
                    message: `PDF has ${pdfPageCount} pages, but order spec requires ${productionSpecs.pageCount} pages.`
                });
            }
        }

        // Check B: Trim Size Mismatch
        const pdfTrim = this.getTrimFromTechnicalFacts(technicalFacts);
        if (productionSpecs.trimWidthMm > 0 && pdfTrim.width > 0) {
            const deltaW = Math.abs(pdfTrim.width - productionSpecs.trimWidthMm);
            const deltaH = Math.abs(pdfTrim.height - productionSpecs.trimHeightMm);
            const threshold = policy.mismatch_severities?.trim_size_delta_mm_threshold || 5.0;

            if (deltaW > threshold || deltaH > threshold) {
                findings.push({
                    id: 'TRIM_SIZE_MISMATCH',
                    severity: policy.mismatch_severities?.trim_size_mismatch || 'warning',
                    scope: 'physical',
                    message: `PDF trim (${pdfTrim.width}x${pdfTrim.height}) differs from spec (${productionSpecs.trimWidthMm}x${productionSpecs.trimHeightMm}).`
                });
            }
        }

        // Check C: Intent vs Binding Mismatch
        const inferredBinding = this.mapIntentToBinding(productionIntent.primary_intent);
        if (productionSpecs.bindingType && productionSpecs.bindingType !== inferredBinding) {
            findings.push({
                id: 'INTENT_BINDING_MISMATCH',
                severity: policy.mismatch_severities?.intent_binding_mismatch || 'warning',
                scope: 'operative',
                message: `Document intent implies '${inferredBinding}', but order specifies '${productionSpecs.bindingType}'.`
            });
        }

        // 3. Spine Analysis
        const theoretical = spineCalculator.calculateTheoreticalSpine({
            pageCount: pdfPageCount,
            paperType: productionSpecs.paperType || 'coated',
            paperGsm: productionSpecs.paperGsm || 130
        });

        // Heuristic detected spine - Use spec trim width as anchor if possible
        const detectedSpineResult = this.detectSpineFromGeometry(technicalFacts, productionSpecs.trimWidthMm || pdfTrim.width);

        // 4. Detailed Binding Checks
        // Check D: Page Count vs Binding Limits
        const pageLimitsCheck = this.checkPageLimits(pdfPageCount, bindingType, limits);
        evidence.push(pageLimitsCheck.evidence);
        if (pageLimitsCheck.finding) findings.push(pageLimitsCheck.finding);

        // Check E: Spine Delta
        if (detectedSpineResult.value > 0) {
            const deltaEval = spineCalculator.evaluateDelta(detectedSpineResult.value, theoretical.spine_mm, bindingType);
            evidence.push({
                id: 'spine_alignment',
                scope: 'physical',
                passed: deltaEval.status === 'ok',
                message: `Detected spine (${detectedSpineResult.value}mm) vs Theoretical (${theoretical.spine_mm}mm)`,
                details: {
                    ...deltaEval,
                    source: detectedSpineResult.source,
                    confidence: detectedSpineResult.confidence,
                    theoretical_source: theoretical.source
                }
            });

            if (deltaEval.classification !== 'GREEN') {
                findings.push({
                    id: deltaEval.classification === 'BLOCKING' ? 'SPINE_DELTA_BLOCKING' : 'SPINE_DELTA_ATTENTION',
                    severity: deltaEval.classification === 'BLOCKING' ? 'error' : 'warning',
                    scope: 'physical',
                    message: `Spine deviation of ${deltaEval.delta}mm detected.`
                });
            }
        }

        // 5. Final Status Determination
        const hasBlocking = findings.some(f => f.severity === 'error');
        const hasWarnings = findings.some(f => f.severity === 'warning');

        let status = policy.status_mapping?.no_issues || 'ready';
        if (hasBlocking) status = policy.status_mapping?.has_blocking_error || 'incompatible';
        else if (hasWarnings) status = policy.status_mapping?.has_warnings_only || 'conditionally_ready';

        return {
            binding_type: bindingType,
            binding_source: bindingSource,
            status,
            spine: {
                theoretical_mm: theoretical.spine_mm,
                theoretical_source: theoretical.source,
                detected_mm: detectedSpineResult.value || null,
                detected_source: detectedSpineResult.source,
                detected_confidence: detectedSpineResult.confidence
            },
            evidence,
            findings
        };
    }

    mapIntentToBinding(intent) {
        if (intent === 'paperback_novel') return 'perfect';
        if (intent === 'hardcover_photo_book') return 'hardcover_casebound';
        if (intent === 'booklet_saddle_stitch') return 'saddle';
        return 'perfect';
    }

    checkPageLimits(pageCount, bindingType, limits) {
        const evidence = { id: 'page_count_feasibility', scope: 'physical', passed: true };
        let finding = null;

        if (pageCount < limits.min_pages) {
            evidence.passed = false;
            evidence.message = `Page count (${pageCount}) is below min for ${bindingType} (${limits.min_pages})`;
            finding = { id: 'INSUFFICIENT_PAGES_FOR_BINDING', severity: 'error', scope: 'physical', message: evidence.message };
        } else if (limits.max_pages && pageCount > limits.max_pages) {
            evidence.passed = false;
            evidence.message = `Page count (${pageCount}) exceeds max for ${bindingType} (${limits.max_pages})`;
            finding = { id: 'EXCESSIVE_PAGES_FOR_BINDING', severity: 'error', scope: 'physical', message: evidence.message };
        }

        return { evidence, finding };
    }

    detectSpineFromGeometry(facts, anchorTrimWidth) {
        const pages = facts.pages || [];
        if (pages.length === 0) return { value: 0, source: 'none', confidence: 'none' };

        const firstPage = pages[0];
        if (anchorTrimWidth > 0 && firstPage.width > (anchorTrimWidth * 2)) {
            return {
                value: Number((firstPage.width - (anchorTrimWidth * 2)).toFixed(3)),
                source: 'geometry_anchor_spec',
                confidence: 'high'
            };
        }

        const detectedTrimWidth = this.parseTrimWidth(facts.info?.trimBox);
        if (detectedTrimWidth > 0 && firstPage.width > (detectedTrimWidth * 2)) {
            return {
                value: Number((firstPage.width - (detectedTrimWidth * 2)).toFixed(3)),
                source: 'geometry_heuristic_spread',
                confidence: 'medium'
            };
        }

        return { value: 0, source: 'pdf_page_probes', confidence: 'low' };
    }

    getTrimFromTechnicalFacts(facts) {
        const box = facts.info?.trimBox;
        if (!box) return { width: 0, height: 0 };
        const pts = Array.isArray(box) ? box : String(box).split(/\s+/).map(Number);
        if (pts.length < 4) return { width: 0, height: 0 };
        return {
            width: Number(((pts[2] - pts[0]) * 0.3528).toFixed(2)),
            height: Number(((pts[3] - pts[1]) * 0.3528).toFixed(2))
        };
    }

    parseTrimWidth(boxStr) {
        const t = this.getTrimFromTechnicalFacts({ info: { trimBox: boxStr } });
        return t.width;
    }

    createErrorResponse(type, message) {
        return {
            binding_type: type,
            status: 'incompatible',
            findings: [{ id: 'BINDING_RULE_NOT_FOUND', severity: 'error', scope: 'physical', message }],
            evidence: [{ id: 'binding_rule_check', scope: 'physical', passed: false, message }]
        };
    }
}

module.exports = new BindingIntelligenceService();
