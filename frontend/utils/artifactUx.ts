import type { ArtifactUxContract, ArtifactTrust } from '../types';

export type ArtifactAudience = 'customer' | 'operator';

export interface ResolvedArtifactUx {
  display_label: string;
  button_label: string;
  status_badge: string;
  tooltip: string;
}

// Conservative fallbacks — never overclaim production readiness
const FALLBACK_CORRECTED: ResolvedArtifactUx = {
  display_label: 'Corrected file',
  button_label: 'Download corrected file',
  status_badge: 'Corrected',
  tooltip: 'Download the automatically corrected file',
};

const FALLBACK_REVIEW: ResolvedArtifactUx = {
  display_label: 'Review file',
  button_label: 'Download review file',
  status_badge: 'Review required',
  tooltip: 'This file requires review before production use',
};

const FALLBACK_PROCESSED: ResolvedArtifactUx = {
  display_label: 'Processed file',
  button_label: 'Download processed file',
  status_badge: 'Processed',
  tooltip: 'Download the processed file',
};

// Patterns that overclaim production certification — forbidden in customer views
const OVERCLAIM_PATTERNS = [
  /certified pdf/gi,
  /print.?ready/gi,
  /pdf\/x\s*(certified|compliant)/gi,
  /pdf\/a\s*(certified|compliant)/gi,
  /production.?certified/gi,
  /production.?ready/gi,
];

function sanitizeCustomerLabel(label: string, certifiedAllowed: boolean, standardCertified: boolean): string {
  if (certifiedAllowed && standardCertified) return label;
  let out = label;
  for (const re of OVERCLAIM_PATTERNS) {
    out = out.replace(re, 'corrected file');
  }
  return out;
}

/**
 * Returns the safe display/button/badge/tooltip for a given artifact based on
 * backend-provided artifact_ux and artifact_trust.  Never defaults to Certified PDF
 * or print-ready unless the OS explicitly grants it via artifact_trust.
 */
export function getArtifactUxForArtifact(
  artifact: { type?: string; key?: string; filename?: string } | null | undefined,
  artifactUxContract: ArtifactUxContract | null | undefined,
  artifactTrust: ArtifactTrust | null | undefined,
  audience: ArtifactAudience = 'customer'
): ResolvedArtifactUx {
  const reviewRequired =
    artifactTrust?.review_required === true ||
    artifactTrust?.production_certified === false ||
    artifactTrust?.customer_visible === false;

  const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;
  const standardCertified = artifactTrust?.standard_certified === true;

  // 1. Prefer backend-provided artifact_ux labels
  if (artifactUxContract) {
    const audienceLabels =
      audience === 'operator'
        ? artifactUxContract.operator_labels
        : artifactUxContract.customer_labels;

    // For operator audience also accept top-level labels
    const topLevel =
      audience === 'operator'
        ? {
            button_label: artifactUxContract.button_label,
            display_label: artifactUxContract.display_label,
            status_badge: artifactUxContract.status_badge,
            tooltip: artifactUxContract.tooltip,
          }
        : null;

    const raw = audienceLabels || topLevel;
    if (raw?.display_label) {
      const display = audience === 'customer'
        ? sanitizeCustomerLabel(raw.display_label, certifiedAllowed, standardCertified)
        : raw.display_label;
      const button = audience === 'customer'
        ? sanitizeCustomerLabel(raw.button_label || FALLBACK_CORRECTED.button_label, certifiedAllowed, standardCertified)
        : (raw.button_label || FALLBACK_CORRECTED.button_label);
      return {
        display_label: display,
        button_label: button,
        status_badge: raw.status_badge || (reviewRequired ? FALLBACK_REVIEW.status_badge : FALLBACK_CORRECTED.status_badge),
        tooltip: raw.tooltip || FALLBACK_CORRECTED.tooltip,
      };
    }
  }

  // 2. Conservative fallback driven by trust
  if (reviewRequired) return FALLBACK_REVIEW;

  const primaryType =
    artifactTrust?.primary_artifact_type ||
    artifact?.type ||
    artifact?.key;

  if (!primaryType) return FALLBACK_PROCESSED;

  if (certifiedAllowed && standardCertified && primaryType === 'certified_pdf') {
    return {
      display_label: 'Standards-validated file',
      button_label: 'Download standards-validated file',
      status_badge: 'Standards-validated',
      tooltip: 'This file has been validated against print standards',
    };
  }

  if (primaryType === 'review_pdf') return FALLBACK_REVIEW;

  if (primaryType === 'final_fixed_pdf' || primaryType === 'fixed_pdf') {
    return { ...FALLBACK_CORRECTED };
  }

  if (primaryType === 'normalized_pdf') return { ...FALLBACK_PROCESSED };

  return { ...FALLBACK_PROCESSED };
}

/**
 * Returns false when downloading certified_pdf should be blocked by artifact_trust.
 * Operator audience can still access a certified_pdf marked as review artifact.
 */
export function isCertifiedPdfDownloadAllowed(
  artifactKey: string,
  artifactTrust: ArtifactTrust | null | undefined,
  audience: ArtifactAudience = 'customer'
): boolean {
  if (artifactKey !== 'certified_pdf') return true;
  if (!artifactTrust) return true; // no trust data — legacy allow
  if (artifactTrust.certified_pdf_allowed === false) {
    if (audience === 'operator' && artifactTrust.review_required === true) return true;
    return false;
  }
  return true;
}

/**
 * Selects the primary downloadable artifact key based on artifact_trust,
 * then falls back to best-fit order.  Never returns certified_pdf unless
 * artifact_trust explicitly allows it.
 */
export function selectPrimaryArtifactKey(
  artifacts: Record<string, string> | null | undefined,
  artifactTrust: ArtifactTrust | null | undefined,
  audience: ArtifactAudience = 'customer'
): string | null {
  if (!artifacts || Object.keys(artifacts).length === 0) return null;

  // Use OS-provided primary type first
  const primary = artifactTrust?.primary_artifact_type;
  if (primary && artifacts[primary] && isCertifiedPdfDownloadAllowed(primary, artifactTrust, audience)) {
    return primary;
  }

  // Best-fit fallback — certified_pdf is gated by trust
  const priority: string[] = ['final_fixed_pdf', 'fixed_pdf', 'normalized_pdf', 'certified_pdf', 'review_pdf'];
  for (const key of priority) {
    if (artifacts[key] && isCertifiedPdfDownloadAllowed(key, artifactTrust, audience)) {
      return key;
    }
  }

  return null;
}

/**
 * Produces a safe download filename for the artifact.
 * Never appends "-certified" unless artifact_trust explicitly allows certified PDF.
 */
export function getArtifactFilename(
  baseName: string | null | undefined,
  artifactKey: string | null | undefined,
  artifactTrust: ArtifactTrust | null | undefined
): string {
  const base = baseName || 'document';
  const cleanBase = base.toLowerCase().endsWith('.pdf') ? base.slice(0, -4) : base;

  const certifiedAllowed = artifactTrust?.certified_pdf_allowed !== false;
  const standardCertified = artifactTrust?.standard_certified === true;

  if (artifactKey === 'certified_pdf' && certifiedAllowed && standardCertified) {
    return `${cleanBase}-certified.pdf`;
  }
  if (artifactKey === 'review_pdf') {
    return `${cleanBase}-review.pdf`;
  }
  if (artifactKey === 'final_fixed_pdf' || artifactKey === 'fixed_pdf') {
    return `${cleanBase}-corrected.pdf`;
  }
  return `${cleanBase}-corrected.pdf`;
}
