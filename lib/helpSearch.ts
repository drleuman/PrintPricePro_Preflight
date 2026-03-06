import Fuse from 'fuse.js';
import { adminHelpDocs, HelpDoc } from '../data/adminKnowledgeBase';

const options = {
    keys: ['title', 'summary', 'keywords', 'category'],
    threshold: 0.3,
};

const fuse = new Fuse(adminHelpDocs, options);

export const searchHelpDocs = (query: string): HelpDoc[] => {
    if (!query) return adminHelpDocs;
    return fuse.search(query).map(result => result.item);
};

export const getHelpDocById = (id: string): HelpDoc | undefined => {
    let doc = adminHelpDocs.find(doc => doc.id === id);
    if (!doc && id.startsWith('error-')) {
        doc = adminHelpDocs.find(d => d.id === 'error-generic');
    }
    return doc;
};

export const getCategories = (): string[] => {
    const categories = new Set(adminHelpDocs.map(doc => doc.category));
    return Array.from(categories).sort();
};

export const getErrorArticleLink = (errorCode: string): string => {
    if (!errorCode || typeof errorCode !== 'string') return '/admin/help?doc=error-generic';

    const normalized = errorCode.toUpperCase().trim();
    const candidateId = `error-${normalized.toLowerCase().replace(/_/g, '-')}`;

    if (adminHelpDocs.some(doc => doc.id === candidateId)) {
        return `/admin/help?doc=${candidateId}`;
    }

    // Match partials prefixing
    const partialMatch = adminHelpDocs.find(doc =>
        doc.type === 'error' &&
        doc.id !== 'error-generic' &&
        normalized.includes(doc.id.replace('error-', '').replace(/-/g, '_').toUpperCase())
    );

    if (partialMatch) {
        return `/admin/help?doc=${partialMatch.id}`;
    }

    // Provide generic error id so the smart fallback banner is triggered
    return `/admin/help?doc=${candidateId}`;
};
