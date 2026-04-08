export const formatLabel = (label: string | undefined | null): string => {
  if (!label) return '';
  
  // Handle strings with " / " specifically
  if (label.includes(' / ')) {
    return label.split(' / ')
      .map(part => formatLabel(part.trim()))
      .join(' / ');
  }

  // Handle strings with ":" specifically
  if (label.includes(': ')) {
    const [key, val] = label.split(': ');
    return `${formatLabel(key.trim())}: ${formatLabel(val.trim())}`;
  }

  return label
    .toLowerCase()
    .split('_')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const humanize = (str: string | undefined | null): string => {
    return formatLabel(str);
};

/**
 * Normalizes a filename for download according to brand guidelines (Monolith v2.4).
 * Removes extensions, sanitizes special characters, and appends the appropriate suffix.
 */
export const normalizeDownloadFilename = (originalName: string | undefined | null, artifactType: 'pdf' | 'report'): string => {
  const base = originalName || 'document';
  
  // 1. Remove extension
  let normalized = base.replace(/\.[^/.]+$/, "");
  
  // 2. Sanitize: replace spaces and slashes with _, remove other special chars except . _ -
  normalized = normalized.replace(/[\s\/\\]+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  
  // 3. Append suffix based on type
  if (artifactType === 'pdf') {
    return `${normalized}-certified.pdf`;
  }
  return `${normalized}-report.json`;
};
