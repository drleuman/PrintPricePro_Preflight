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

  // Summary
  issuesSummary: 'Issues Summary',
  overallScore: 'Overall Score',
  issueCategories: 'Issue Categories',
  fileLabel: 'File',

  // Viewer
  pdfViewer: 'PDF Viewer',
  pageNavigation: 'Page Navigation',
  prevPage: 'Previous Page',
  nextPage: 'Next Page',
  goToPage: 'Go to page',
  typePageNumber: 'Type page number',

  // Generic labels
  severity: 'Severity',
  page: 'Page',
  message: 'Message',
  details: 'Details',
  close: 'Close',

  // States
  noPdfLoaded: 'No PDF loaded. Please upload a file to begin.',
  noIssuesToDisplay: 'No issues to display.',
  noIssuesFound: 'No issues found. Your PDF looks perfect!',

  // Issues panel
  issuesFound: 'Issues Found',
  issues: 'Issues',
  errors: 'Errors',
  warnings: 'Warnings',
  info: 'Info',
  selectAnIssue: 'Select an issue to view its details and potential fixes.',
  selectedIssueDetails: 'Selected Issue Details',
  currentIssue: 'Current Issue',
categoryPageSetup: 'Page setup',
  categoryAnnotations: 'Annotations',
  categoryFormFields: 'Form fields',
  categoryMultimedia: 'Multimedia',
  categoryLayers: 'Layers',
  // AI actions (panel / drawer)
  // OJO: dejamos las dos keys como alias, por si el código usa una u otra
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
  drawerActions: 'Actions',
  actions: 'Actions', // alias para evitar MISSING_TRANSLATION:actions
  severityError: 'Error',
  severityWarning: 'Warning',
  severityInfo: 'Info',
  issue: 'Issue',

  // Hint para el bloque IA dentro del drawer
  aiHintInDrawer:
    'Use the AI buttons to get a detailed explanation or efficiency tips for this issue.',
} as const;

export const es = {
  // (solo las claves que necesitas en español por ahora)

  appName: 'PDF Preflight Check',

  // Drawer / issue details
  selectedIssueDetails: 'Detalle de la incidencia seleccionada',
  currentIssue: 'Incidencia actual',
  pageLabel: 'Página {{page}}',
  close: 'Cerrar',
  details: 'Detalles',
  suggestedFix: 'Sugerencia de corrección',
  drawerActions: 'Acciones',
  actions: 'Acciones', // alias
  severityError: 'Error',
  severityWarning: 'Advertencia',
  severityInfo: 'Información',
  issue: 'Incidencia',

  // AI en drawer
  explainSuggestFix: 'Explicar y sugerir corrección (Auditoría IA)',
  explainAndSuggestFix: 'Explicar y sugerir corrección (Auditoría IA)',
  getEfficiencyTips: 'Ver consejos de eficiencia (Auditoría IA)',
  fetchingAIResponse: 'Obteniendo respuesta de la IA...',
  aiHintInDrawer:
    'Usa los botones de IA para obtener una explicación detallada o consejos de eficiencia sobre esta incidencia.',
} as const;

// Si sólo tipas con el inglés:
export type TranslationKeys = keyof typeof en;
