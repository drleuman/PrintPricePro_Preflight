import React from 'react';
import { SafeHtmlMarkdown } from './SafeHtmlMarkdown';

interface Props {
    report: string;
}

export const AnalyzeCarrierReport: React.FC<Props> = ({ report }) => {
    // Basic structural parsing of AI markdown to add hierarchy if it's just a wall of text
    // although SafeHtmlMarkdown handles basic md, we want a "editorial" card-based layout
    
    const sections = parseReportSections(report);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {sections.map((section, idx) => (
                <div 
                    key={idx} 
                    className="p-5 border border-[var(--border-color)] bg-[var(--bg-secondary)]/20 shadow-sm relative overflow-hidden group hover:border-[var(--accent-color)]/30 transition-colors"
                >
                    {section.title && (
                        <div className="flex items-center gap-2 mb-4">
                            <div className="h-1 w-1 bg-[var(--accent-color)]" />
                            <h3 className="text-[0.7rem] font-black uppercase tracking-[0.2em] text-[var(--accent-color)]">
                                {section.title}
                            </h3>
                        </div>
                    )}
                    <div className="prose prose-invert prose-sm max-w-none 
                        prose-p:text-[var(--text-secondary)] 
                        prose-p:leading-[1.7] 
                        prose-p:text-[0.8rem]
                        prose-headings:text-[var(--text-primary)]
                        prose-headings:text-[0.85rem]
                        prose-headings:font-bold
                        prose-headings:uppercase
                        prose-headings:tracking-wider
                        prose-strong:text-[var(--text-primary)]
                        prose-li:text-[var(--text-secondary)]">
                        <SafeHtmlMarkdown markdown={section.content} />
                    </div>
                </div>
            ))}
        </div>
    );
};

interface ReportSection {
    title: string | null;
    content: string;
}

function parseReportSections(text: string): ReportSection[] {
    // If text has headers (### or ##), split by them
    const headerRegex = /^#{1,3}\s+(.+)$/gm;
    const parts = text.split(/^#{1,3}\s+/gm);
    
    if (parts.length <= 1) {
        // No headers found, create a generic "Executive Summary" if it's too long
        return [{ title: "EXECUTIVE SUMMARY", content: text }];
    }

    const sections: ReportSection[] = [];
    const headers = Array.from(text.matchAll(headerRegex)).map(m => m[1]);
    
    // The first part might be empty if it starts with a header
    if (parts[0].trim()) {
        sections.push({ title: "SUMMARY", content: parts[0].trim() });
    }

    for (let i = 1; i < parts.length; i++) {
        const header = headers[i-1] || `SECTION ${i}`;
        sections.push({ title: header.toUpperCase(), content: parts[i].trim() });
    }

    return sections;
}
