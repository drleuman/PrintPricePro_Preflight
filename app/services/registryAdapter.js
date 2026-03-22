'use strict';

/**
 * services/registryAdapter.js
 * 
 * Lean registry adapter for Phase 18.C.
 * Provides basic metadata for common preflight findings.
 */

const ISSUE_REGISTRY = {
    'fonts-not-embedded': {
        title: 'Fonts Not Embedded',
        type: 'technical',
        severity: 'error',
        user_message: 'Some fonts are not embedded in the PDF. This may lead to incorrect characters when printing.',
        fix: 'EMBED_ALL_FONTS'
    },
    'low-resolution-images': {
        title: 'Low Resolution Images',
        type: 'technical',
        severity: 'warning',
        user_message: 'Images with resolution below 150 DPI detected. Quality may be poor.',
        fix: 'UPSCALE_OR_REPLACE'
    },
    'missing-bleed-info': {
        title: 'Missing Bleed Information',
        type: 'geometry',
        severity: 'error',
        user_message: 'Document does not have required bleed margins or BleedBox.',
        fix: 'ADD_3MM_BLEED'
    },
    'text-outline-risk': {
        title: 'Text Outline Risk',
        type: 'heuristic',
        severity: 'info',
        user_message: 'Text might be converted to outlines. This limits searchability.',
        fix: null
    }
};

function getIssueRegistry() {
    return ISSUE_REGISTRY;
}

module.exports = {
    getIssueRegistry
};






















