import { describe, it, expect } from 'vitest';
import { normalizeArtifactIdForRoute } from './usePdfTools';

describe('normalizeArtifactIdForRoute', () => {
    it('normalizes fixed.pdf to fixed_pdf', () => {
        expect(normalizeArtifactIdForRoute('fixed.pdf')).toBe('fixed_pdf');
    });

    it('normalizes certified.pdf to certified_pdf', () => {
        expect(normalizeArtifactIdForRoute('certified.pdf')).toBe('certified_pdf');
    });

    it('normalizes normalized.pdf to normalized_pdf', () => {
        expect(normalizeArtifactIdForRoute('normalized.pdf')).toBe('normalized_pdf');
    });

    it('normalizes report.json to analysis_report', () => {
        expect(normalizeArtifactIdForRoute('report.json')).toBe('analysis_report');
    });

    it('normalizes fix_audit.json to fix_audit', () => {
        expect(normalizeArtifactIdForRoute('fix_audit.json')).toBe('fix_audit');
    });

    it('leaves already normalized keys alone', () => {
        expect(normalizeArtifactIdForRoute('fixed_pdf')).toBe('fixed_pdf');
        expect(normalizeArtifactIdForRoute('review_pdf')).toBe('review_pdf');
    });

    it('handles empty strings and null gracefully', () => {
        expect(normalizeArtifactIdForRoute('')).toBe('');
        // @ts-ignore
        expect(normalizeArtifactIdForRoute(null)).toBe('null');
        // @ts-ignore
        expect(normalizeArtifactIdForRoute(undefined)).toBe('undefined');
    });
});
