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
