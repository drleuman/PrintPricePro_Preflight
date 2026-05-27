import { ClientChangeReport, ClientChangeItem, PreflightResult } from '../types';

export function generateClientChangeReport(result: any): ClientChangeReport {
  const isCertified = result?.productionCertified === true;
  const requiresReview = result?.requiresHumanReview === true;
  
  const statusTone = isCertified ? 'success' : requiresReview ? 'warning' : 'neutral';
  
  const headline = isCertified 
    ? "Your PDF is production certified and ready for printing."
    : "Your PDF was technically repaired, but it still needs production review.";
    
  const statusLabel = isCertified ? "Ready for production" : "Review required";
  
  const executiveSummary = isCertified
    ? "We corrected the document structure needed for printing and verified that the file meets all automated production criteria."
    : "We corrected the document structure needed for printing. However, the repaired PDF is not automatically production-certified because some changes (like added bleed) require human confirmation.";

  const changesApplied: ClientChangeItem[] = [];
  const itemsSkipped: ClientChangeItem[] = [];
  const stillNeedsReview: ClientChangeItem[] = [];
  const detectedBefore: ClientChangeItem[] = [];
  
  // Mappings
  const appliedFixes = Array.isArray(result?.fixes) ? result.fixes : (Array.isArray(result?.applied_fixes) ? result.applied_fixes : []);
  const skippedFixes = Array.isArray(result?.skipped_fixes) ? result.skipped_fixes : [];
  const reviewReasons = Array.isArray(result?.reviewReasons) ? result.reviewReasons : [];
  const issuesBefore = Array.isArray(result?.summary?.before?.issues) ? result.summary.before.issues : (Array.isArray(result?.issues) ? result.issues : []);

  appliedFixes.forEach((fix: any) => {
    const code = typeof fix === 'string' ? fix : fix?.type || fix?.code;
    if (code === 'REBUILD_TRIMBOX') {
      changesApplied.push({
        title: "Page trim area was rebuilt",
        plainLanguage: "We added or corrected the page trim boundary so the printer knows the intended final cut size of the document.",
        technicalCode: code,
        impact: "Improves page cutting and alignment.",
        status: "applied"
      });
    }
    if (code === 'APPLY_BLEED') {
      changesApplied.push({
        title: "Bleed area was added",
        plainLanguage: "We expanded the bleed box so artwork can safely extend beyond the final cut line.",
        technicalCode: code,
        impact: "This helps avoid white edges after trimming.",
        status: "applied"
      });
    }
    if (code === 'INJECT_OUTPUT_INTENT') {
      changesApplied.push({
        title: "Print color profile was added",
        plainLanguage: "We added an output intent/profile so the PDF better communicates its intended print color condition.",
        technicalCode: code,
        impact: "Improves compatibility with print workflow checks.",
        status: "applied"
      });
    }
  });

  skippedFixes.forEach((fix: any) => {
    const code = typeof fix === 'string' ? fix : fix?.type || fix?.code;
    if (code === 'CONVERT_CMYK') {
      itemsSkipped.push({
        title: "RGB-to-CMYK conversion was not applied automatically",
        plainLanguage: "The PDF contains RGB elements, but automatic conversion to CMYK can change colors. To avoid unintended visual changes, this conversion was not applied automatically.",
        technicalCode: code,
        impact: "A print operator or designer should decide whether color conversion is required.",
        status: "skipped"
      });
    }
  });

  reviewReasons.forEach((reason: string) => {
    if (reason === 'APPLY_BLEED') {
      stillNeedsReview.push({
        title: "Confirm that the added bleed area is visually valid",
        plainLanguage: "This was done as a box expansion. A production operator should confirm that the artwork itself actually extends into the bleed area.",
        technicalCode: reason,
        status: "review"
      });
    }
  });

  if (itemsSkipped.some(item => item.technicalCode === 'CONVERT_CMYK')) {
    stillNeedsReview.push({
      title: "Decide whether RGB objects should be converted to CMYK",
      plainLanguage: "A print operator or designer should review the colors before final printing.",
      status: "review"
    });
  }

  issuesBefore.forEach((issue: any) => {
    const title = typeof issue === 'string' ? issue : issue?.title || issue?.message || '';
    if (title.includes('PDF/X Compliance Missing') || title.includes('PDF/X')) {
      detectedBefore.push({
        title: "PDF/X compliance marker is missing",
        plainLanguage: "The file does not declare itself as a PDF/X-compliant print file.",
        impact: "This is not always fatal, but some print workflows require PDF/X.",
        status: "detected"
      });
      stillNeedsReview.push({
        title: "Confirm PDF/X compliance requirements for the selected print workflow",
        plainLanguage: "Check if the print facility requires a specific PDF/X standard.",
        status: "review"
      });
    }
    if (title.includes('Text Possibly Converted to Outlines') || title.includes('outlines')) {
      detectedBefore.push({
        title: "Text may already be outlined",
        plainLanguage: "The system did not detect embedded live fonts. The text may have been converted to vector outlines.",
        impact: "This is usually printable, but text may no longer be editable.",
        status: "detected"
      });
    }
    if (title.includes('RGB Objects Detected') || title.includes('RGB')) {
      detectedBefore.push({
        title: "RGB color objects were detected",
        plainLanguage: "Some objects use screen-oriented RGB color instead of print-oriented CMYK.",
        impact: "Colors may shift if converted during production.",
        status: "detected"
      });
    }
    if (title.includes('ICC Profile Missing')) {
      detectedBefore.push({
        title: "Embedded color profile was missing",
        plainLanguage: "The document did not include a complete embedded print color profile before repair.",
        impact: "Color interpretation may vary between workflows.",
        status: "detected"
      });
    }
    if (title.includes('OutputIntent Missing')) {
      detectedBefore.push({
        title: "Output intent was missing",
        plainLanguage: "The PDF did not clearly declare the intended printing condition. This has now been added.",
        status: "detected"
      });
    }
  });

  // Remove duplicates from detectedBefore and stillNeedsReview
  const uniqueDetected = Array.from(new Map(detectedBefore.map(item => [item.title, item])).values());
  const uniqueNeedsReview = Array.from(new Map(stillNeedsReview.map(item => [item.title, item])).values());

  const operatorNotes: string[] = [];
  if (requiresReview) {
    operatorNotes.push("A production operator must review this file before printing.");
  }

  const customerMessage = isCertified
    ? "Your PDF was successfully repaired and is now production certified. We added print output intent/profile information. The document is ready for final printing."
    : "Your PDF was technically repaired but is not yet production certified. " + 
      (changesApplied.length > 0 ? "We " + changesApplied.map(c => c.plainLanguage.toLowerCase()).join(" ") : "") + 
      (itemsSkipped.length > 0 ? " " + itemsSkipped.map(c => c.title.toLowerCase() + " because it can change the visual appearance of the document.").join(" ") : "") +
      " A production operator should review the file and decide on any skipped conversions before final printing.";

  return {
    headline,
    statusLabel,
    statusTone,
    executiveSummary,
    productionReadiness: {
      certified: isCertified,
      label: isCertified ? "Production certified" : "Not production certified yet",
      explanation: isCertified 
        ? "The file is technically improved and meets all automated criteria for production."
        : "The file is technically improved, but it needs human review before being used for final production."
    },
    changesApplied,
    itemsSkipped,
    stillNeedsReview: uniqueNeedsReview,
    detectedBefore: uniqueDetected,
    customerMessage,
    operatorNotes
  };
}
