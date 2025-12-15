// profiles/defaultProfile.ts
import type { Issue, IssueCategory } from '../types';
import { ISSUE_CATEGORY } from '../types';

export type IssueHint = {
  /** Breve título para mostrar en UI */
  shortTitle: string;
  /** Explicación humana corta, pensada para el usuario final */
  userFriendlySummary: string;
  /**
   * Guía para la IA: qué debe priorizar al explicar/solucionar
   * este tipo de issue (se inyecta en los prompts).
   */
  aiPrompt: string;
};

/**
 * Mapa de hints por issue.id tal y como los genera el worker.
 * Si cambias o añades nuevos ids en el worker, añádelos aquí.
 */
const ISSUE_HINTS_BY_ID: Record<string, IssueHint> = {
  // 1) Documento vacío
  'empty-document': {
    shortTitle: 'Empty or invalid PDF',
    userFriendlySummary:
      'The file seems to contain no valid pages. This usually means the export failed or the PDF is damaged.',
    aiPrompt:
      'Focus on explaining why a PDF might appear to have no pages (failed export, damaged file, wrong format) and how to re-export from layout tools (InDesign, Word) with correct PDF/X settings. Emphasize checking the PDF in Acrobat or another viewer to confirm page count and content before resending to print.',
  },

  // 2) Trim fuera de MediaBox
  'trim-outside-mediabox': {
    shortTitle: 'TrimBox outside MediaBox',
    userFriendlySummary:
      'The trim area extends beyond the media box. This can cause unexpected cropping or misalignment in imposition.',
    aiPrompt:
      'Explain what MediaBox and TrimBox are in practical terms and why TrimBox must stay inside MediaBox. Provide step-by-step instructions in Acrobat Preflight and InDesign to correct page boxes or re-export the PDF with correct document size and bleed settings.',
  },

  // 3) Mezcla de tamaños de página
  'mixed-page-sizes': {
    shortTitle: 'Mixed page sizes',
    userFriendlySummary:
      'Different pages have different dimensions. For books, this usually causes problems in imposition and binding.',
    aiPrompt:
      'Emphasize that a book interior should use a consistent trim size. Show how to detect mixed sizes in Acrobat (Page Thumbnails, Preflight) and how to normalize page sizes in InDesign or via PDF tools (scale pages, re-export with a single document size).',
  },

  // 4) Tamaño no estándar
  'non-standard-size': {
    shortTitle: 'Non-standard page size',
    userFriendlySummary:
      'The document uses a non-standard page size. This may be fine, but it can affect price and print house compatibility.',
    aiPrompt:
      'Explain the impact of custom sizes on printing cost and feasibility (paper usage, imposition, standard formats). Suggest checking with the print house and, if needed, adapting to common book sizes (A5, 170×240 mm, A4, etc.) before export.',
  },

  // 5) Contenido en color
  'color-content-detected': {
    shortTitle: 'Color content detected',
    userFriendlySummary:
      'The document contains color operations. If the job is meant to be grayscale, some content might be in color by mistake.',
    aiPrompt:
      'Distinguish between color books and black-only interiors. For grayscale/black-only jobs, explain how to find color objects (Output Preview, Preflight checks) and convert them to grayscale (Photoshop, InDesign, Acrobat Preflight). Mention CMYK vs RGB and why accidental color raises costs.',
  },

  // 6) Sin operadores de color explícitos
  'no-explicit-color-ops': {
    shortTitle: 'No explicit color operators',
    userFriendlySummary:
      'No RGB color drawing operators were detected. The document likely behaves as grayscale or black-only.',
    aiPrompt:
      'Confirm that this is usually good for economical black-and-white book interiors. Suggest a quick check in Acrobat’s Output Preview to ensure there are no hidden color objects or spot colors before sending to print.',
  },

  // 7) Transparencias
  'transparency-detected': {
    shortTitle: 'Transparency detected',
    userFriendlySummary:
      'Transparency or alpha blending is used. On some RIPs this may cause unexpected flattening or artifacts.',
    aiPrompt:
      'Explain what transparency means in PDFs (drop shadows, opacity, blending modes) and how older RIPs can mis-handle it. Provide steps to flatten transparencies safely (InDesign export settings, Acrobat Preflight/Flattener, PitStop) and suggest checking results with overprint preview and separations.',
  },

  // 8) Sin info de bleed
  'missing-bleed-info': {
    shortTitle: 'Missing bleed boxes',
    userFriendlySummary:
      'The PDF does not define explicit TrimBox/BleedBox on all sampled pages. Bleed may be missing or undefined.',
    aiPrompt:
      'Explain bleed in very practical terms (extra image beyond trim to avoid white edges) and why 3 mm is typical for books. Show how to set bleed correctly in InDesign export and how to verify TrimBox/BleedBox in Acrobat (Preflight, Set Page Boxes). Emphasize resupplying the PDF with proper bleed settings.',
  },

  // 9) Sangrado insuficiente
  'insufficient-bleed': {
    shortTitle: 'Insufficient bleed (< 3 mm)',
    userFriendlySummary:
      'The bleed margin is smaller than about 3 mm on some pages. This increases the risk of white edges after trimming.',
    aiPrompt:
      'Explain why 3 mm (or similar) bleed is the norm, especially for full-bleed covers and interiors. Provide concrete steps to extend artwork in InDesign, Illustrator, or Photoshop, and export again with correct bleed. Mention checking with a print template and verifying in Acrobat.',
  },

  // 10) Fuentes Type 3
  'type3-fonts-present': {
    shortTitle: 'Type 3 fonts detected',
    userFriendlySummary:
      'The PDF uses Type 3 fonts, which are legacy and can render unpredictably on some RIPs.',
    aiPrompt:
      'Explain what Type 3 fonts are in simple terms and why they are risky for print. Suggest replacing them with OpenType/TrueType fonts, re-exporting from the original layout, or using Acrobat/PitStop to outline text if absolutely necessary. Emphasize checking key pages after fixing.',
  },

  // 11) Resumen de fuentes usadas
  'fonts-used-summary': {
    shortTitle: 'Fonts used (summary)',
    userFriendlySummary:
      'This is a list of font families detected in the sampled pages, including whether they appear subsetted.',
    aiPrompt:
      'Use this information to help the user audit their font usage: embedded vs subset, potential licensing issues, and where missing fonts might cause reflow. Do not mark this as a “problem” by itself; instead, turn it into practical advice on managing fonts for long-run book printing.',
  },

  // 12) Texto demasiado pequeño
  'text-too-small': {
    shortTitle: 'Very small text (< 6 pt)',
    userFriendlySummary:
      'Some text runs are below about 6 pt, which is usually too small for comfortable reading in print.',
    aiPrompt:
      'Explain reading comfort, paper texture, and ink spread for small sizes. Suggest minimum sizes for body text, footnotes, and legal text. Provide steps to enlarge text styles in InDesign and reflow the layout, and mention test prints for critical small text (maps, diagrams, captions).',
  },

  // 13) Texto pequeño pero aceptable
  'text-small': {
    shortTitle: 'Small text (≈ 6–8 pt)',
    userFriendlySummary:
      'Some text is between roughly 6 and 8 pt. This can work for footnotes, but may be problematic for long reading or low contrast.',
    aiPrompt:
      'Discuss when 6–8 pt is acceptable (footnotes, references) and when it becomes risky (low-contrast colors, thin fonts, coated vs uncoated papers). Advise on checking legibility with a printed proof and adjusting styles where needed.',
  },

  // 14) Imágenes de baja resolución
  'low-resolution-images': {
    shortTitle: 'Low-resolution images',
    userFriendlySummary:
      'One or more images have an estimated resolution below ~150 DPI at their printed size, which may look soft or pixelated.',
    aiPrompt:
      'Explain effective resolution vs file resolution, and why 300 DPI at final print size is standard. Guide the user to: (1) identify which images are low-res, (2) replace with higher-resolution sources, or (3) reduce the printed size to increase effective DPI. Mention avoiding upsampling as a “fake fix”.',
  },

  // 15) Sin imágenes
  'no-images-detected': {
    shortTitle: 'No bitmap images detected',
    userFriendlySummary:
      'No bitmap image XObjects were found in the sampled pages. This is normal for text-only interiors.',
    aiPrompt:
      'Clarify that this is not an error for text-only books. Suggest a quick sanity check: if the book is supposed to have photos or illustrations, the user should verify that they were properly placed and exported.',
  },

  // 16) Anotaciones / comentarios
  'annotations-present': {
    shortTitle: 'Annotations or comments present',
    userFriendlySummary:
      'The PDF still contains annotations, comments, or markup. These can appear in output or confuse the print workflow.',
    aiPrompt:
      'Explain the risks of leaving annotations (sticky notes, highlights, review marks) in a print-ready PDF. Provide steps to flatten or remove annotations in Acrobat (Comments list, Preflight, “Remove annotations”) and recommend exporting a clean, final version from the layout tool.',
  },

  // 17) Campos de formulario
  'form-fields-present': {
    shortTitle: 'Form fields present',
    userFriendlySummary:
      'Interactive form fields (text fields, checkboxes, etc.) are still in the PDF. They may not print as intended.',
    aiPrompt:
      'Clarify that interactive PDF forms are for on-screen use, not for static book printing. Show how to flatten form fields in Acrobat or re-export from the source app with fields converted to static content. Emphasize checking that all values remain visible after flattening.',
  },

  // 18) Contenido multimedia
  'multimedia-content': {
    shortTitle: 'Multimedia content present',
    userFriendlySummary:
      'The PDF contains multimedia elements (video, audio, 3D, file attachments) that cannot be reproduced in print.',
    aiPrompt:
      'Explain why multimedia has no meaning in a printed book. Show how to remove or replace multimedia with static frames or alternative content. Instruct the user to ensure that any essential information is represented as static text/images before sending to print.',
  },

  // 19) Capas / OCG
  'layers-detected': {
    shortTitle: 'Layers (Optional Content Groups)',
    userFriendlySummary:
      'The document uses layers. This can be useful, but for print you should ensure that only the correct layers are visible.',
    aiPrompt:
      'Describe how layers/OCGs can be used (language versions, technical overlays) and why they must be checked before print. Explain how to show/hide layers in Acrobat, and when to flatten them (e.g. when sending to a simple workflow). Emphasize avoiding accidental hidden text or extra versions in the final print.',
  },

  // 20) PDF muy grande
  'very-large-file': {
    shortTitle: 'Very large PDF file',
    userFriendlySummary:
      'The file is unusually large. This can slow down uploads, processing, and imposition, and may indicate unoptimized images.',
    aiPrompt:
      'Guide the user to optimize the PDF: compress or downsample images appropriately, remove unused objects and layers, and avoid embedding unnecessary assets. Mention Acrobat’s “Save as Optimized PDF”, InDesign export settings, and balancing file size vs quality for print.',
  },
};

/* =========================================================
   Fallback genéricos por categoría
   ======================================================= */

const CATEGORY_FALLBACKS: Record<IssueCategory, IssueHint> = {
  [ISSUE_CATEGORY.IMAGES]: {
    shortTitle: 'Image-related issue',
    userFriendlySummary:
      'There is a potential problem with bitmap images (resolution, color mode, or placement).',
    aiPrompt:
      'Explain common print issues with images: low resolution, RGB instead of CMYK, incorrect profiles, or scaling beyond 100–120%. Provide generic checks in Acrobat/Preflight and layout tools to ensure images are suitable for offset or digital printing.',
  },
  [ISSUE_CATEGORY.COLOR]: {
    shortTitle: 'Color usage issue',
    userFriendlySummary:
      'There is something noteworthy about how color is used in this PDF (RGB vs CMYK, spot colors, or mixed content).',
    aiPrompt:
      'Discuss color management for print: CMYK vs RGB, spot colors, and when color content is appropriate or problematic for a job. Provide generic advice on checking separations in Acrobat and converting content when needed.',
  },
  [ISSUE_CATEGORY.FONTS]: {
    shortTitle: 'Font or text issue',
    userFriendlySummary:
      'There is a potential font or text problem (embedding, type, or legibility).',
    aiPrompt:
      'Cover typical font issues: not embedded fonts, legacy types, and text that is too small or too thin. Give generic recommendations for embedding fonts, outlining text when absolutely necessary, and checking legibility with a printed proof.',
  },
  [ISSUE_CATEGORY.METADATA]: {
    shortTitle: 'Document setup issue',
    userFriendlySummary:
      'There is something noteworthy about the PDF setup (file size, page count, format, or metadata).',
    aiPrompt:
      'Give general advice on preparing a print-ready PDF: correct page count, version, file size, and PDF/X profiles. Focus on practical checks in Acrobat and re-export settings in layout tools.',
  },
  [ISSUE_CATEGORY.TRANSPARENCY]: {
    shortTitle: 'Transparency issue',
    userFriendlySummary:
      'The document uses transparency or effects that may need flattening for stable print output.',
    aiPrompt:
      'Explain transparency, overprint, and flattening in generic terms. Describe how to check for transparency in Acrobat and how to flatten it safely in InDesign or via Acrobat Preflight for older RIPs.',
  },
  [ISSUE_CATEGORY.BLEED_MARGINS]: {
    shortTitle: 'Bleed & margins issue',
    userFriendlySummary:
      'There seems to be a problem with page bleed or margins that could cause white edges or unsafe trim.',
    aiPrompt:
      'Provide general guidance on bleed and safe areas for books and covers, typical values (3 mm bleed, 5–10 mm safety), and how to fix these settings in layout software and verify them in Acrobat.',
  },
  [ISSUE_CATEGORY.RESOLUTION]: {
    shortTitle: 'Resolution / sharpness issue',
    userFriendlySummary:
      'There is a potential problem with the resolution or sharpness of some elements in the PDF.',
    aiPrompt:
      'Talk about effective resolution for print (usually 300 DPI for images at final size), line art vs photos, and how scaling affects sharpness. Suggest generic checks in Acrobat Preflight and how to replace or resize low-resolution assets.',
  },
  [ISSUE_CATEGORY.COMPLIANCE]: {
    shortTitle: 'PDF compliance issue',
    userFriendlySummary:
      'The file may not fully comply with the requested PDF/X or print profile.',
    aiPrompt:
      'Explain what PDF/X compliance means in practice (embedded fonts, output intent, no RGB/annotations, etc.). Give generic steps to run a compliance profile in Acrobat Preflight and to re-export the file with the correct standard from InDesign or similar tools.',
  },
  [ISSUE_CATEGORY.PAGE_SETUP]: {
    shortTitle: 'Page setup inconsistency',
    userFriendlySummary:
      'The page size or orientation may be inconsistent or non-standard for this project.',
    aiPrompt:
      'Explain why consistent page size and orientation matter, especially for bound books. Provide generic steps to normalize page setup in the layout file and re-export the PDF.',
  },
  [ISSUE_CATEGORY.ANNOTATIONS]: {
    shortTitle: 'Review marks or annotations',
    userFriendlySummary:
      'The PDF still contains review annotations or markup that should usually be removed before print.',
    aiPrompt:
      'Give general steps to find and delete/flatten annotations in Acrobat and to export a clean, final PDF from the layout application.',
  },
  [ISSUE_CATEGORY.FORM_FIELDS]: {
    shortTitle: 'Interactive form content',
    userFriendlySummary:
      'Interactive form fields are present, which are not intended for static book printing.',
    aiPrompt:
      'Explain that interactive PDFs are not suitable for print and provide generic methods to flatten or remove form fields while preserving their visible content.',
  },
  [ISSUE_CATEGORY.MULTIMEDIA]: {
    shortTitle: 'Non-printable multimedia',
    userFriendlySummary:
      'The PDF contains multimedia elements that will not appear in print.',
    aiPrompt:
      'Explain why multimedia cannot be printed and suggest replacing it with static images or text that conveys the same information, then re-exporting the PDF.',
  },
  [ISSUE_CATEGORY.LAYERS]: {
    shortTitle: 'Layered content',
    userFriendlySummary:
      'The document uses layers, which might hide or show different content depending on viewer settings.',
    aiPrompt:
      'Advise on checking layer visibility and, if needed, flattening layers for a single final version. Mention checking for accidental hidden text or duplicate language versions.',
  },
  [ISSUE_CATEGORY.OTHER]: {
    shortTitle: 'Other preflight issue',
    userFriendlySummary:
      'There is a preflight issue that does not fit into the standard categories, but it may still affect print quality or workflow.',
    aiPrompt:
      'Provide general but practical guidance: explain how to inspect the affected area, check bleed, resolution, color, fonts and page boxes, and decide whether the issue is cosmetic or critical for print. Keep the advice focused on book/interior/cover production.',
  },
};

/* =========================================================
   getIssueHint(issue) – API principal
   ======================================================= */

export function getIssueHint(issue: Issue): IssueHint {
  if (!issue) {
    return {
      shortTitle: 'Generic preflight issue',
      userFriendlySummary:
        'There is a preflight issue in this PDF. Review it carefully before sending the file to print.',
      aiPrompt:
        'Give generic yet practical advice on checking a PDF for print: bleed, margins, colors, images, and fonts. Be concise and actionable.',
    };
  }

  // 1) Intento por id exacto
  if (issue.id && ISSUE_HINTS_BY_ID[issue.id]) {
    return ISSUE_HINTS_BY_ID[issue.id];
  }

  // 2) Fallback por categoría
  if (issue.category && CATEGORY_FALLBACKS[issue.category]) {
    return CATEGORY_FALLBACKS[issue.category];
  }

  // 3) Fallback muy genérico
  return {
    shortTitle: 'Preflight issue',
    userFriendlySummary:
      'There is an issue flagged by the preflight engine. It should be reviewed and fixed before the file goes to press.',
    aiPrompt:
      'Provide generic but practical guidance on investigating and fixing a PDF preflight issue for book printing: check page size, bleed, resolution, colors (CMYK vs RGB), and fonts. Keep the advice tool-agnostic but mention Acrobat and InDesign when useful.',
  };
}
