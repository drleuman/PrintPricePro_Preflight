
import { Severity, IssueCategory } from './types';

export const SEVERITY_COLORS: Record<Severity, string> = {
  [Severity.INFO]: 'text-blue-600 bg-blue-100',
  [Severity.WARNING]: 'text-orange-600 bg-orange-100',
  [Severity.ERROR]: 'text-red-600 bg-red-100',
};

export const SEVERITY_ICONS: Record<Severity, string> = {
  [Severity.INFO]: 'ℹ️',
  [Severity.WARNING]: '⚠️',
  [Severity.ERROR]: '⛔',
};

import { IssueCategory } from './types';

export const ISSUE_CATEGORY_LABELS: Record<IssueCategory | 'other', string> = {
  images: 'Images',
  color: 'Color Spaces',
  fonts: 'Fonts',
  metadata: 'Metadata',
  transparency: 'Transparency',
  bleed_margins: 'Bleed & Margins',
  resolution: 'Resolution',
  compliance: 'Compliance',
  page_setup: 'Page setup',
  annotations: 'Annotations',
  form_fields: 'Form fields',
  multimedia: 'Multimedia',
  layers: 'Layers',
  other: 'Other',
};



