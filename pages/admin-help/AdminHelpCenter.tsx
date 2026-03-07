import React, { useState, useEffect, useRef } from 'react';
import { searchHelpDocs, getCategories } from '../../lib/helpSearch';
import { adminHelpDocs, HelpDoc } from '../../data/adminKnowledgeBase';
import {
    MagnifyingGlassIcon,
    BookOpenIcon,
    ChartBarIcon,
    CommandLineIcon,
    ExclamationTriangleIcon,
    BeakerIcon,
    ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { postHelpAnalytics } from '../../lib/adminApi';

const getIconForType = (type: string) => {
    switch (type) {
        case 'metric': return <ChartBarIcon className="w-5 h-5 text-blue-500" />;
        case 'error': return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
        case 'control': return <CommandLineIcon className="w-5 h-5 text-blue-500" />;
        case 'runbook': return <BookOpenIcon className="w-5 h-5 text-purple-500" />;
        default: return <BeakerIcon className="w-5 h-5 text-slate-500" />;
    }
};

export const AdminHelpCenter: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [results, setResults] = useState<HelpDoc[]>([]);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const categories = ['All', ...getCategories()];

    useEffect(() => {
        // Initial data sync
        setResults(adminHelpDocs);
        console.log('HelpCenter: Initialized with docs:', adminHelpDocs.length);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && document.activeElement !== searchInputRef.current) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        let filtered = adminHelpDocs;

        if (searchQuery.trim()) {
            filtered = searchHelpDocs(searchQuery);
        }

        if (selectedCategory && selectedCategory !== 'All') {
            filtered = filtered.filter(doc => doc.category === selectedCategory);
        }

        console.log(`HelpCenter: Filtered to ${filtered.length} docs (q: "${searchQuery}", cat: "${selectedCategory}")`);
        setResults(filtered);
    }, [searchQuery, selectedCategory]);

    // Track search query when user stops typing for 1 second
    useEffect(() => {
        if (!searchQuery.trim()) return;
        const timeout = setTimeout(() => {
            postHelpAnalytics({ event_type: 'search_query', search_query: searchQuery.trim() }).catch(console.error);
        }, 1000);
        return () => clearTimeout(timeout);
    }, [searchQuery]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-64 bg-white border-r border-slate-200 shrink-0 p-6 flex flex-col h-auto md:h-screen md:sticky md:top-0">
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <BookOpenIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-slate-900 tracking-tight">Help Console</span>
                </div>

                <nav className="space-y-1">
                    <a
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg mb-6 font-medium transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        Back to Dashboard
                    </a>

                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 px-3">Categories</div>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedCategory === cat
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-10 max-w-5xl">
                {/* Search Bar */}
                <div className="relative mb-10 group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="block w-full pl-11 pr-14 py-4 border-slate-200 rounded-2xl leading-5 bg-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"
                        placeholder="Search for metrics, alerts, errors, controls..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <kbd className="inline-flex items-center border border-slate-200 rounded px-2 text-sm font-sans font-medium text-slate-400">
                            /
                        </kbd>
                    </div>
                </div>

                {/* Results List */}
                <div className="space-y-4 flex-1">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-sm font-medium text-slate-500">
                            Showing {results.length} result{results.length !== 1 ? 's' : ''}
                        </div>
                        {results.length > 0 && (
                            <div className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">
                                Live Data Mode
                            </div>
                        )}
                    </div>

                    {results.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                            <MagnifyingGlassIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900">No results found</h3>
                            <p className="text-slate-500 mt-1">Try adjusting your search query or category filter.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                            {results.map((doc) => (
                                <a
                                    key={doc.id}
                                    href={`/admin/help?doc=${doc.id}`}
                                    onClick={() => postHelpAnalytics({ event_type: 'search_result_clicked', article_id: doc.id, search_query: searchQuery.trim() })}
                                    className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 group-hover:border-blue-100 group-hover:bg-blue-50 transition-colors">
                                            {getIconForType(doc.type)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 leading-none mb-1">{doc.category}</span>
                                            <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">{doc.title}</h3>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed">
                                        {doc.summary}
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-1.5">
                                        {doc.keywords.slice(0, 3).map(k => (
                                            <span key={k} className="bg-slate-50 text-slate-500 text-[10px] px-2 py-0.5 rounded-md border border-slate-100 font-medium group-hover:bg-white group-hover:border-blue-100 transition-colors">#{k}</span>
                                        ))}
                                    </div>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <BookOpenIcon className="w-4 h-4 text-blue-400" />
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};
