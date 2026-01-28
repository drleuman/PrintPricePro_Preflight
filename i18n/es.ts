export const es = {
  // App / header
  appName: 'Verificación Pre-vuelo de PDF',

  // Dropzone / loading
  dragDropPrompt: 'Arrastra y suelta tu PDF aquí, o haz clic para seleccionar un archivo',
  invalidFileType: 'Tipo de archivo inválido. Por favor, sube un archivo PDF.',
  loadingFile: 'Cargando archivo PDF...',
  preparingFileForAnalysis: 'Preparando tu archivo para el análisis.',
  analyzingPDF: 'Analizando PDF...',
  thisMayTakeAMoment: 'Esto puede tardar un momento.',
  runPreflight: 'Ejecutar Verificación Pre-vuelo',
  or: 'o',
  browseYourComputer: 'examinar tu computadora',
  pdfMaxHint: 'PDF · máx. ~50 MB',
  selectedLabel: 'PDF seleccionado',
  changeLabel: 'Cambiar',
  uploadTipLargePdf: 'Consejo: los PDF grandes pueden tardar un poco más.',

  // Step titles and descriptions
  uploadYourPdf: 'Sube tu PDF',
  uploadDescription: 'Selecciona un archivo PDF para iniciar la verificación pre-vuelo',
  analyzingYourPdf: 'Analizando tu PDF...',
  analysisComplete: 'Análisis Completado',
  fixIssuesTitle: 'Corregir Incidencias',
  fixIssuesDescription: 'Revisa y corrige las {{count}} incidencia(s) encontradas en tu PDF',
  reviewAndDownload: 'Revisar y Descargar',
  pdfProcessedReady: 'Tu PDF ha sido procesado y está listo',

  // Navigation
  back: '← Atrás',
  next: 'Siguiente →',
  fixIssues: 'Corregir Incidencias →',
  continueToReview: 'Continuar para Revisar →',
  startOver: 'Empezar de Nuevo',

  // Status messages
  analysisWaitMessage: 'Espera mientras verificamos tu documento para impresión',
  issuesFoundMessage: 'Encontramos algunos elementos que necesitan atención',
  pdfLooksGood: '¡Genial! Tu PDF se ve bien',
  checkingDetails: 'Verificando fuentes, colores, imágenes y más...',
  perfectNoIssues: '¡Perfecto! No se encontraron incidencias',
  readyForPrinting: 'Tu PDF está listo para imprimir',

  // Summary
  issuesSummary: 'Resumen de Incidencias',
  overallScore: 'Puntuación General',
  issueCategories: 'Categorías de Incidencias',
  fileLabel: 'Archivo',
  downloadReport: 'Descargar Informe',
  reanalyzePdf: '🔄 Volver a analizar PDF',
  noPdfLoaded: 'Ningún PDF cargado. Por favor, sube un archivo para empezar.',

  // Viewer
  pdfViewer: 'Visor de PDF',
  pageNavigation: 'Navegación por Páginas',
  prevPage: 'Página Anterior',
  nextPage: 'Página Siguiente',
  goToPage: 'Ir a la página',
  typePageNumber: 'Escribe el número de página',

  // Heatmap & Visual Check
  heatmap: 'Mapa de Calor',
  aiVisualCheck: 'Verificación Visual IA',
  toggleTacHeatmap: 'Alternar Mapa de Calor TAC (Cobertura Total de Área)',
  aiVisualQualityCheck: 'Verificación de Calidad Visual IA',
  analyzingInk: 'Analizando Tinta...',
  tacLessThan280: '<280%',
  tac280to300: '280-300%',
  tacMoreThan300: '>300%',

  // Generic labels
  severity: 'Severidad',
  page: 'Página',
  message: 'Mensaje',
  details: 'Detalles',
  close: 'Cerrar',
  error: 'Error',

  // States
  noIssuesToDisplay: 'No hay incidencias para mostrar.',
  noIssuesFound: '¡No se encontraron incidencias. Tu PDF se ve perfecto!',
  noIssues: 'No hay incidencias',

  // Issues panel
  issuesFound: 'Incidencias Encontradas',
  issues: 'Incidencias',
  errors: 'Errores',
  warnings: 'Advertencias',
  info: 'Información',
  errAbbr: 'err',
  warnAbbr: 'adv',
  infoAbbr: 'inf',
  selectAnIssue: 'Selecciona una incidencia para ver sus detalles y posibles soluciones.',
  selectedIssueDetails: 'Detalle de la Incidencia Seleccionada',
  currentIssue: 'Incidencia Actual',
  categoryPageSetup: 'Configuración de Página',
  categoryAnnotations: 'Anotaciones',
  categoryFormFields: 'Campos de Formulario',
  categoryMultimedia: 'Multimedia',
  categoryLayers: 'Capas',

  // Quick Fixes
  quickFixes: 'Soluciones Rápidas',
  aiAssistance: 'Asistencia IA',
  add3mmBleed: '🔧 Añadir Sangrado de 3mm',
  convertToCMYK: '🎨 Convertir a CMYK',
  convertToGrayscaleBtn: '⚫ Convertir a Escala de Grises',
  rebuildHighRes300dpi: '🛠️ Reconstruir Alta Resolución (300 DPI)',
  converting: 'Convirtiendo...',

  // CMYK Profiles
  cmykProfile: 'Perfil CMYK:',
  genericCMYK: 'CMYK Genérico',
  coatedFogra39: 'Coated FOGRA39 (ISO 12647-2:2004)',
  gracol2006: 'GRACoL 2006 (Coated #1)',
  swop2006: 'SWOP 2006 (Coated #3)',
  uncoatedFogra29: 'Uncoated FOGRA29',

  // Optional Tools (Step 4)
  optionalTools: 'Herramientas Opcionales',
  additionalProcessingOptions: 'Opciones de procesamiento adicionales',
  convertToGrayscale: 'Convertir a Escala de Grises',
  convertColorsToCMYK: 'Convertir Colores a CMYK',
  rebuildPdfHighRes: 'Reconstruir PDF (Alta Resolución)',
  createBooklet: 'Crear Folleto',
  downloadProcessedPdf: 'Descargar PDF Procesado',

  // Stepper
  stepNumber: 'Paso {{number}}',
  uploadPdf: 'Subir PDF',
  analysis: 'Análisis',
  review: 'Revisar',

  // AI actions (panel / drawer)
  explainSuggestFix: 'Explicar y Sugerir Corrección (Auditoría IA)',
  explainAndSuggestFix: 'Explicar y Sugerir Corrección (Auditoría IA)',
  getEfficiencyTips: 'Obtener Consejos de Eficiencia (Auditoría IA)',
  aiAuditTitle: 'Auditoría IA: Explicar y Sugerir Correcciones',
  efficiencyAuditTitle: 'Auditoría IA: Obtener Consejos de Eficiencia',
  fetchingAIResponse: 'Obteniendo respuesta de la IA...',
  aiResponse: 'Respuesta de la IA',
  aiError: 'No se pudo obtener la respuesta de la IA. Por favor, verifica tu clave API y vuelve a intentarlo.',
  geminiKeyMissingError:
    'La clave API de Gemini falta o es inválida. Las características de IA están deshabilitadas.',
  billingDocLink: 'Ver documentación de facturación',
  visualMode: 'Modo Visual',

  // AI helper descriptions
  fastestFix: 'Solución Más Rápida',
  bestFix: 'Mejor Solución',
  timeImpact: 'Impacto en el Tiempo',
  costImpact: 'Impacto en el Costo',
  aiDescriptionExplain:
    'Obtén una explicación detallada de esta incidencia y sugerencias paso a paso sobre cómo solucionarla, incluyendo instrucciones específicas para herramientas comunes como Adobe InDesign o Acrobat.',
  aiDescriptionEfficiency:
    'Descubre las formas más eficientes de resolver esta incidencia. Compara la solución más rápida con la de mejor calidad, y entiende sus posibles impactos en tiempo y costo.',

  // Drawer / issue details
  pageLabel: 'Página {{page}}',
  suggestedFix: 'Sugerencia de corrección',
  issueSummary: 'Resumen de la Incidencia',
  engineHint: 'Pista del Motor',
  drawerActions: 'Acciones',
  actions: 'Acciones',
  severityError: 'Error',
  severityWarning: 'Advertencia',
  severityInfo: 'Información',
  issue: 'Incidencia',

  // Hint para el bloque IA dentro del drawer
  aiHintInDrawer:
    'Usa los botones de IA para obtener una explicación detallada o consejos de eficiencia sobre esta incidencia.',

  // UploadStepSimple (Modern headerless)
  aiMagicFix: 'AI Magic Fix',
  aiMagicFixDesc: 'Un solo clic. Nos encargamos de todo automáticamente.',
  manualMode: 'Manual',
  manualModeDesc: 'Para usuarios avanzados que quieren revisar problemas y elegir correcciones.',
  recommended: 'Recomendado',
  bestWithAi: 'Mejor con AI Magic Fix',
  readyForAnalysis: 'Listo para análisis',
  browseFiles: 'Examinar archivos',
  processingTime: 'Tiempo de procesamiento',
  processingTimeVal: '~10-60 segundos',
  pdfLimit: 'PDF hasta 50 MB',
  magicWait: 'Espere a que ocurra la magia',
  dragAndDropModern: 'Arrastre y suelte su PDF',
  changeFile: 'Cambiar archivo seleccionado',
  safeProcessing: 'Procesamiento seguro y temporal',
  continue: 'Continuar',
  headerUploadTitle: 'Sube tu PDF',
  headerUploadSubset: 'Elige AI Magic Fix (recomendado) o Manual.',
  chooseWorkflow: 'Elige flujo de trabajo',
  recommendMagicHint: 'Recomendamos Magic Fix para la mayoría.',
  uploadToContinue: 'Suba un PDF para continuar.',
  magicPoint1: 'Corrige los problemas de impresión más comunes',
  magicPoint2: 'Genera un PDF listo para imprimir',
  magicPoint3: 'Sin conocimientos técnicos requeridos',
  tempProcessNote: 'Procesamos tu archivo temporalmente y lo limpiamos automáticamente.',
} as const;
