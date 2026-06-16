import { describe, it, expect } from 'vitest';
import {
  getArtifactUxForArtifact,
  isCertifiedPdfDownloadAllowed,
  selectPrimaryArtifactKey,
  getArtifactFilename,
} from './artifactUx';
import type { ArtifactTrust, ArtifactUxContract } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const trustCertified: ArtifactTrust = {
  certified_pdf_allowed: true,
  standard_certified: true,
  production_certified: true,
  review_required: false,
  customer_visible: true,
};

const trustUncertified: ArtifactTrust = {
  certified_pdf_allowed: false,
  standard_certified: false,
  production_certified: false,
  review_required: false,
  customer_visible: true,
};

const trustReviewRequired: ArtifactTrust = {
  certified_pdf_allowed: false,
  standard_certified: false,
  review_required: true,
};

// ---------------------------------------------------------------------------
// getArtifactUxForArtifact
// ---------------------------------------------------------------------------

describe('getArtifactUxForArtifact', () => {
  it('returns FALLBACK_PROCESSED when artifact and trust are null', () => {
    const result = getArtifactUxForArtifact(null, null, null);
    expect(result.status_badge).toBe('Processed');
    expect(result.button_label).toBe('Download processed file');
  });

  it('returns FALLBACK_REVIEW when review_required=true', () => {
    const result = getArtifactUxForArtifact(null, null, trustReviewRequired);
    expect(result.status_badge).toBe('Review required');
    expect(result.button_label).toBe('Download review file');
  });

  it('returns FALLBACK_REVIEW when production_certified=false', () => {
    const trust: ArtifactTrust = { production_certified: false };
    const result = getArtifactUxForArtifact(null, null, trust);
    expect(result.status_badge).toBe('Review required');
  });

  it('returns FALLBACK_REVIEW when customer_visible=false', () => {
    const trust: ArtifactTrust = { customer_visible: false };
    const result = getArtifactUxForArtifact(null, null, trust);
    expect(result.status_badge).toBe('Review required');
  });

  it('returns standards-validated UX for certified_pdf with full trust', () => {
    const artifact = { type: 'certified_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, trustCertified);
    expect(result.display_label).toBe('Standards-validated file');
    expect(result.status_badge).toBe('Standards-validated');
  });

  it('does NOT return certified UX when certified_pdf_allowed=false even for certified_pdf type', () => {
    const artifact = { type: 'certified_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, trustUncertified);
    expect(result.display_label).not.toContain('certified');
    expect(result.status_badge).not.toBe('Standards-validated');
  });

  it('returns FALLBACK_CORRECTED for fixed_pdf type', () => {
    const artifact = { type: 'fixed_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, null);
    expect(result.status_badge).toBe('Corrected');
    expect(result.button_label).toBe('Download corrected file');
  });

  it('returns FALLBACK_CORRECTED for final_fixed_pdf type', () => {
    const artifact = { type: 'final_fixed_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, null);
    expect(result.status_badge).toBe('Corrected');
  });

  it('returns FALLBACK_REVIEW for review_pdf type', () => {
    const artifact = { type: 'review_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, null);
    expect(result.status_badge).toBe('Review required');
  });

  it('returns FALLBACK_PROCESSED for normalized_pdf type', () => {
    const artifact = { type: 'normalized_pdf' };
    const result = getArtifactUxForArtifact(artifact, null, null);
    expect(result.status_badge).toBe('Processed');
  });

  describe('with artifact_ux contract', () => {
    const contract: ArtifactUxContract = {
      customer_labels: {
        display_label: 'Your corrected PDF',
        button_label: 'Download corrected PDF',
        status_badge: 'Ready',
        tooltip: 'Safe to use',
      },
    };

    it('uses customer_labels for customer audience', () => {
      const result = getArtifactUxForArtifact(null, contract, trustCertified, 'customer');
      expect(result.display_label).toBe('Your corrected PDF');
      expect(result.status_badge).toBe('Ready');
    });

    it('sanitizes overclaiming labels for customer audience when not certified', () => {
      const badContract: ArtifactUxContract = {
        customer_labels: {
          display_label: 'Certified PDF ready for print-ready production',
          button_label: 'Download certified pdf',
          status_badge: 'Certified',
          tooltip: 'PDF/X certified compliant',
        },
      };
      const result = getArtifactUxForArtifact(null, badContract, trustUncertified, 'customer');
      expect(result.display_label).not.toMatch(/certified pdf/i);
      expect(result.display_label).not.toMatch(/print.?ready/i);
      expect(result.button_label).not.toMatch(/certified pdf/i);
    });

    it('does NOT sanitize labels when certifiedAllowed+standardCertified are both true', () => {
      const premiumContract: ArtifactUxContract = {
        customer_labels: {
          display_label: 'Certified PDF',
          button_label: 'Download certified pdf',
          status_badge: 'Certified',
          tooltip: 'Your certified file',
        },
      };
      const result = getArtifactUxForArtifact(null, premiumContract, trustCertified, 'customer');
      expect(result.display_label).toBe('Certified PDF');
      expect(result.button_label).toBe('Download certified pdf');
    });

    it('uses operator_labels for operator audience', () => {
      const opContract: ArtifactUxContract = {
        operator_labels: {
          display_label: 'Operator view',
          button_label: 'Download operator PDF',
          status_badge: 'Operator ready',
          tooltip: 'Operator tooltip',
        },
      };
      const result = getArtifactUxForArtifact(null, opContract, trustCertified, 'operator');
      expect(result.display_label).toBe('Operator view');
    });

    it('falls back to top-level labels for operator when operator_labels absent', () => {
      const topLevelContract: ArtifactUxContract = {
        display_label: 'Top-level label',
        button_label: 'Top-level button',
        status_badge: 'Top',
        tooltip: 'Top tooltip',
      };
      const result = getArtifactUxForArtifact(null, topLevelContract, trustCertified, 'operator');
      expect(result.display_label).toBe('Top-level label');
    });
  });
});

// ---------------------------------------------------------------------------
// isCertifiedPdfDownloadAllowed
// ---------------------------------------------------------------------------

describe('isCertifiedPdfDownloadAllowed', () => {
  it('returns true for non-certified artifact keys regardless of trust', () => {
    expect(isCertifiedPdfDownloadAllowed('fixed_pdf', trustUncertified)).toBe(true);
    expect(isCertifiedPdfDownloadAllowed('final_fixed_pdf', null)).toBe(true);
    expect(isCertifiedPdfDownloadAllowed('review_pdf', trustReviewRequired)).toBe(true);
  });

  it('returns true when trust is null (legacy allow)', () => {
    expect(isCertifiedPdfDownloadAllowed('certified_pdf', null)).toBe(true);
  });

  it('returns true when certified_pdf_allowed is not set to false', () => {
    const trust: ArtifactTrust = { production_certified: true };
    expect(isCertifiedPdfDownloadAllowed('certified_pdf', trust)).toBe(true);
  });

  it('returns false for customer when certified_pdf_allowed=false', () => {
    expect(isCertifiedPdfDownloadAllowed('certified_pdf', trustUncertified, 'customer')).toBe(false);
  });

  it('returns true for operator with certified_pdf_allowed=false AND review_required=true', () => {
    const trust: ArtifactTrust = { certified_pdf_allowed: false, review_required: true };
    expect(isCertifiedPdfDownloadAllowed('certified_pdf', trust, 'operator')).toBe(true);
  });

  it('returns false for operator when certified_pdf_allowed=false but review_required is NOT true', () => {
    const trust: ArtifactTrust = { certified_pdf_allowed: false, review_required: false };
    expect(isCertifiedPdfDownloadAllowed('certified_pdf', trust, 'operator')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// selectPrimaryArtifactKey
// ---------------------------------------------------------------------------

describe('selectPrimaryArtifactKey', () => {
  it('returns null for null artifacts', () => {
    expect(selectPrimaryArtifactKey(null, null)).toBeNull();
  });

  it('returns null for empty artifacts object', () => {
    expect(selectPrimaryArtifactKey({}, null)).toBeNull();
  });

  it('returns trust primary_artifact_type when present in artifacts', () => {
    const artifacts = { final_fixed_pdf: '/path/final.pdf', fixed_pdf: '/path/fixed.pdf' };
    const trust: ArtifactTrust = { primary_artifact_type: 'final_fixed_pdf' };
    expect(selectPrimaryArtifactKey(artifacts, trust)).toBe('final_fixed_pdf');
  });

  it('falls back to priority order when primary_artifact_type not in artifacts', () => {
    const artifacts = { fixed_pdf: '/path/fixed.pdf', normalized_pdf: '/path/norm.pdf' };
    expect(selectPrimaryArtifactKey(artifacts, null)).toBe('fixed_pdf');
  });

  it('respects priority: final_fixed_pdf > fixed_pdf > normalized_pdf > certified_pdf', () => {
    const allArtifacts = {
      certified_pdf: '/c.pdf',
      normalized_pdf: '/n.pdf',
      fixed_pdf: '/f.pdf',
      final_fixed_pdf: '/ff.pdf',
    };
    expect(selectPrimaryArtifactKey(allArtifacts, null)).toBe('final_fixed_pdf');
  });

  it('skips certified_pdf when not allowed by trust', () => {
    const artifacts = { certified_pdf: '/c.pdf', normalized_pdf: '/n.pdf' };
    const trust: ArtifactTrust = { certified_pdf_allowed: false };
    expect(selectPrimaryArtifactKey(artifacts, trust, 'customer')).toBe('normalized_pdf');
  });

  it('allows certified_pdf when trust is null (legacy)', () => {
    const artifacts = { certified_pdf: '/c.pdf' };
    expect(selectPrimaryArtifactKey(artifacts, null)).toBe('certified_pdf');
  });

  it('skips trust primary_artifact_type when isCertifiedPdfDownloadAllowed returns false', () => {
    const artifacts = { certified_pdf: '/c.pdf', fixed_pdf: '/f.pdf' };
    const trust: ArtifactTrust = {
      primary_artifact_type: 'certified_pdf',
      certified_pdf_allowed: false,
    };
    expect(selectPrimaryArtifactKey(artifacts, trust, 'customer')).toBe('fixed_pdf');
  });
});

// ---------------------------------------------------------------------------
// getArtifactFilename
// ---------------------------------------------------------------------------

describe('getArtifactFilename', () => {
  it('uses "document" as base when baseName is null', () => {
    expect(getArtifactFilename(null, 'fixed_pdf', null)).toBe('document-corrected.pdf');
  });

  it('strips .pdf extension before appending suffix', () => {
    expect(getArtifactFilename('myfile.pdf', 'fixed_pdf', null)).toBe('myfile-corrected.pdf');
  });

  it('does not double-strip extension when baseName has no .pdf', () => {
    expect(getArtifactFilename('myfile', 'fixed_pdf', null)).toBe('myfile-corrected.pdf');
  });

  it('appends -certified for certified_pdf when trust allows', () => {
    expect(getArtifactFilename('job123.pdf', 'certified_pdf', trustCertified)).toBe('job123-certified.pdf');
  });

  it('does NOT append -certified when certified_pdf_allowed=false', () => {
    expect(getArtifactFilename('job123.pdf', 'certified_pdf', trustUncertified)).toBe('job123-corrected.pdf');
  });

  it('does NOT append -certified when standard_certified=false even if certified_pdf_allowed=true', () => {
    const trust: ArtifactTrust = { certified_pdf_allowed: true, standard_certified: false };
    expect(getArtifactFilename('job123.pdf', 'certified_pdf', trust)).toBe('job123-corrected.pdf');
  });

  it('appends -review for review_pdf', () => {
    expect(getArtifactFilename('job123.pdf', 'review_pdf', null)).toBe('job123-review.pdf');
  });

  it('appends -corrected for final_fixed_pdf', () => {
    expect(getArtifactFilename('job123.pdf', 'final_fixed_pdf', null)).toBe('job123-corrected.pdf');
  });

  it('appends -corrected for unknown artifact key', () => {
    expect(getArtifactFilename('job123.pdf', 'normalized_pdf', null)).toBe('job123-corrected.pdf');
  });
});
