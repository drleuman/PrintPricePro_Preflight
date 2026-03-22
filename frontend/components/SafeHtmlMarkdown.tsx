import React, { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface SafeHtmlMarkdownProps {
  markdown: string;
  className?: string;
}

export const SafeHtmlMarkdown: React.FC<SafeHtmlMarkdownProps> = ({ markdown, className }) => {
  const sanitizedHtml = useMemo(() => {
    if (!markdown) return '';
    const rawHtml = marked.parse(markdown, {
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Render <br> on hard breaks
    });
    return DOMPurify.sanitize(rawHtml as string, { USE_PROFILES: { html: true } });
  }, [markdown]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
