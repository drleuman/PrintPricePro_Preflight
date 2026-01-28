// translations.ts (o como se llame tu archivo)

export const en = {
  // App / header
  appName: 'PDF Preflight Check',

  // Dropzone / loading
  dragDropPrompt: 'Drag & drop your PDF here, or click to select file',
  invalidFileType: 'Invalid file type. Please upload a PDF file.',
  loadingFile: 'Loading PDF file...',
  preparingFileForAnalysis: 'Preparing your file for analysis.',
  analyzingPDF: 'Analyzing PDF...',
  thisMayTakeAMoment: 'This may take a moment.',
  runPreflight: 'Run Preflight',

  // Step titles and descriptions
  uploadYourPdf: 'Upload Your PDF',
  uploadDescription: 'Select a PDF file to begin the preflight check',
  analyzingYourPdf: 'Analyzing Your PDF...',
  analysisComplete: 'Analysis Complete',
  fixIssuesTitle: 'Fix Issues',
  fixIssuesDescription: 'Review and fix the {{count}} issue(s) found in your PDF',
  reviewAndDownload: 'Review & Download',
  pdfProcessedReady: 'Your PDF has been processed and is ready',

  // Navigation
  back: '← Back',
  next: 'Next →',
  fixIssues: 'Fix Issues →',
  continueToReview: 'Continue to Review →',
  startOver: 'Start Over',

  // Status messages
  analysisWaitMessage: 'Please wait while we check your document for print readiness',
  issuesFoundMessage: 'We found some items that need attention',
  pdfLooksGood: 'Great! Your PDF looks good',
  checkingDetails: 'Checking fonts, colors, images, and more...',
  perfectNoIssues: 'Perfect! No issues found',
  readyForPrinting: 'Your PDF is ready for printing',

  // Summary
  issuesSummary: 'Issues Summary',
  overallScore: 'Overall Score',
  issueCategories: 'Issue Categories',
  fileLabel: 'File',
  downloadReport: 'Download Report',
  reanalyzePdf: '🔄 Re-analyze PDF',

  // Viewer
  pdfViewer: 'PDF Viewer',
  pageNavigation: 'Page Navigation',
  prevPage: 'Previous Page',
  nextPage: 'Next Page',
  goToPage: 'Go to page',
  typePageNumber: 'Type page number',

  // Heatmap & Visual Check
  heatmap: 'Heatmap',
  aiVisualCheck: 'AI Visual Check',
  toggleTacHeatmap: 'Toggle TAC Heatmap (Total Area Coverage)',
  aiVisualQualityCheck: 'AI Visual Quality Check',
  analyzingInk: 'Analyzing Ink...',
  tacLessThan280: '<280%',
  tac280to300: '280-300%',
  tacMoreThan300: '>300%',

  // Generic labels
  severity: 'Severity',
  page: 'Page',
  message: 'Message',
  details: 'Details',
  close: 'Close',
  error: 'Error',

  // States
  noPdfLoaded: 'No PDF loaded. Please upload a file to begin.',
  noIssuesToDisplay: 'No issues to display.',
  noIssuesFound: 'No issues found. Your PDF looks perfect!',
  noIssues: 'No issues',

  // Issues panel
  issuesFound: 'Issues Found',
  issues: 'Issues',
  errors: 'Errors',
  warnings: 'Warnings',
  info: 'Info',
  errAbbr: 'err',
  warnAbbr: 'warn',
  infoAbbr: 'info',
  selectAnIssue: 'Select an issue to view its details and potential fixes.',
  selectedIssueDetails: 'Selected Issue Details',
  currentIssue: 'Current Issue',
  categoryPageSetup: 'Page setup',
  categoryAnnotations: 'Annotations',
  categoryFormFields: 'Form fields',
  categoryMultimedia: 'Multimedia',
  categoryLayers: 'Layers',

  // Quick Fixes
  quickFixes: 'Quick Fixes',
  aiAssistance: 'AI Assistance',
  add3mmBleed: '🔧 Add 3mm Bleed',
  convertToCMYK: '🎨 Convert to CMYK',
  convertToGrayscaleBtn: '⚫ Convert to Grayscale',
  rebuildHighRes300dpi: '🛠️ Rebuild High-Res (300 DPI)',
  converting: 'Converting...',

  // CMYK Profiles
  cmykProfile: 'CMYK Profile:',
  genericCMYK: 'Generic CMYK',
  coatedFogra39: 'Coated FOGRA39 (ISO 12647-2:2004)',
  gracol2006: 'GRACoL 2006 (Coated #1)',
  swop2006: 'SWOP 2006 (Coated #3)',
  uncoatedFogra29: 'Uncoated FOGRA29',

  // Optional Tools (Step 4)
  optionalTools: 'Optional Tools',
  additionalProcessingOptions: 'Additional processing options',
  convertToGrayscale: 'Convert to Grayscale',
  convertColorsToCMYK: 'Convert Colors to CMYK',
  rebuildPdfHighRes: 'Rebuild PDF (High-Res)',
  createBooklet: 'Create Booklet',
  downloadProcessedPdf: 'Download Processed PDF',

  // Stepper
  stepNumber: 'Step {{number}}',
  uploadPdf: 'Upload PDF',
  analysis: 'Analysis',
  review: 'Review',

  // AI actions (panel / drawer)
  explainSuggestFix: 'Explain & Suggest Fix (AI Audit)',
  explainAndSuggestFix: 'Explain & Suggest Fix (AI Audit)',
  getEfficiencyTips: 'Get Efficiency Tips (AI Audit)',
  aiAuditTitle: 'AI Audit: Explain & Suggest Fixes',
  efficiencyAuditTitle: 'AI Audit: Get Efficiency Tips',
  fetchingAIResponse: 'Fetching AI response...',
  aiResponse: 'AI Response',
  aiError: 'Failed to fetch AI response. Please check your API key and try again.',
  geminiKeyMissingError:
    'Gemini API key is missing or invalid. AI features are disabled.',
  billingDocLink: 'See billing documentation',
  visualMode: 'Visual Mode',

  // AI helper descriptions
  fastestFix: 'Fastest Fix',
  bestFix: 'Best Fix',
  timeImpact: 'Time Impact',
  costImpact: 'Cost Impact',
  aiDescriptionExplain:
    'Get a detailed explanation of this issue and step-by-step suggestions on how to fix it, including specific instructions for common tools like Adobe InDesign or Acrobat.',
  aiDescriptionEfficiency:
    'Discover the most efficient ways to resolve this issue. Compare the fastest fix with the best-quality fix, and understand their potential time and cost impacts.',

  // Drawer / issue details
  pageLabel: 'Page {{page}}',
  suggestedFix: 'Suggested fix',
  issueSummary: 'Issue Summary',
  engineHint: 'Engine Hint',
  drawerActions: 'Actions',
  actions: 'Actions',
  severityError: 'Error',
  severityWarning: 'Warning',
  severityInfo: 'Info',
  issue: 'Issue',

  // Hint para el bloque IA dentro del drawer
  aiHintInDrawer:
    'Use the AI buttons to get a detailed explanation or efficiency tips for this issue.',

  // UploadStepSimple (Modern headerless)
  aiMagicFix: 'AI Magic Fix',
  aiMagicFixDesc: 'One click. We handle everything automatically.',
  manualMode: 'Manual',
  manualModeDesc: 'For advanced users who want to review issues and choose fixes.',
  recommended: 'Recommended',
  bestWithAi: 'Best with AI Magic Fix',
  readyForAnalysis: 'Ready for analysis',
  browseFiles: 'Browse files',
  processingTime: 'Processing time',
  processingTimeVal: '~10-60 seconds',
  pdfLimit: 'PDF up to 50 MB',
  magicWait: 'Wait for the magic to happen',
  dragAndDropModern: 'Drag & drop your PDF',
  changeFile: 'Change selected file',
  safeProcessing: 'Safe & temporary processing',
  continue: 'Continue',
  headerUploadTitle: 'Upload your PDF',
  headerUploadSubset: 'Choose AI Magic Fix (recommended) or Manual.',
  chooseWorkflow: 'Choose workflow',
  recommendMagicHint: 'We recommend Magic Fix for most users.',
  uploadToContinue: 'Upload a PDF to continue.',
  magicPoint1: 'Fixes the most common print problems',
  magicPoint2: 'Produces a print-ready PDF you can download',
  magicPoint3: 'No technical knowledge required',
  tempProcessNote: 'We process your file temporarily and clean it up automatically.',
} as const;

export type TranslationKeys = keyof typeof en;
