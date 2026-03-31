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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {sections.map((section, idx) => (
                <div 
                    key={idx} 
                    className="group relative"
                >
                    {/* Decorative element */}
                    <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[var(--accent-color)]/20 rounded-full group-hover:bg-[var(--accent-color)] transition-colors duration-300" />
                    
                    <div className="p-6 bg-[var(--bg-secondary)]/30 border border-[var(--border-color)] hover:border-[var(--accent-color)]/30 hover:bg-[var(--bg-secondary)]/50 transition-all duration-300 shadow-sm rounded-tr-xl rounded-br-xl backdrop-blur-sm">
                        {section.title && (
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-[0.7rem] font-black uppercase tracking-[0.25em] text-[var(--accent-color)] bg-[var(--accent-color)]/5 px-2 py-1 rounded">
                                    {section.title}
                                </h3>
                                <div className="h-px flex-1 ml-4 bg-[var(--border-color)] opacity-50" />
                            </div>
                        )}
                        
                        <div className="ai-report-content text-[var(--text-secondary)] leading-relaxed">
                            <SafeHtmlMarkdown markdown={section.content} className="markdown-body ppp-markdown-v2" />
                        </div>
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
