import React, { useEffect, useState } from 'react';
import { getHelpDocById } from '../../lib/helpSearch';
import { HelpDoc } from '../../data/adminKnowledgeBase';
import { BookOpenIcon, ChartBarIcon, CommandLineIcon, ExclamationTriangleIcon, BeakerIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
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

export const AdminHelpArticle: React.FC = () => {
    const [doc, setDoc] = useState<HelpDoc | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const docId = params.get('doc');
        if (docId) {
            setDoc(getHelpDocById(docId) || null);
            postHelpAnalytics({ event_type: 'article_viewed', article_id: docId }).catch(console.error);
        }
        setLoading(false);
    }, []);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading...</div>;

    if (!doc) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-md">
                    <BookOpenIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-slate-900 mb-2">Document not found</h2>
                    <p className="text-slate-600 mb-6">The knowledge base article you are looking for does not exist or has been removed.</p>
                    <a href="/admin/help" className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition">
                        Back to Help Center
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <a href="/admin" className="text-blue-600 font-bold hover:text-blue-800 transition-colors flex items-center gap-1.5 text-sm">
                        <span>← Back to Dashboard</span>
                    </a>
                    <div className="h-6 w-px bg-slate-300 mx-1" />
                    <a href="/admin/help" className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1 text-sm">
                        <span>Search</span>
                    </a>
                    <div className="h-6 w-px bg-slate-300 mx-1" />
                    <nav className="text-sm font-medium flex items-center gap-2">
                        <span className="text-slate-400 hidden md:inline">{doc.category}</span>
                        <span className="text-slate-300 hidden md:inline">/</span>
                        <span className="text-slate-900 truncate max-w-[150px] md:max-w-md">{doc.title}</span>
                    </nav>
                </div>
                {doc.dashboardPath && (
                    <a
                        href={doc.dashboardPath}
                        className="text-sm border border-slate-200 bg-white hover:bg-slate-50 shadow-sm px-4 py-2 rounded-lg text-slate-700 font-medium flex items-center gap-2 transition"
                    >
                        <span>Open in Cockpit</span>
                        <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </a>
                )}
            </header>

            <div className="max-w-4xl mx-auto px-6 py-10">

                {/* Fallback Banner */}
                {doc.id === 'error-generic' && new URLSearchParams(window.location.search).get('doc') !== 'error-generic' && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 p-4 rounded-xl flex gap-3 text-amber-800 items-start shadow-sm animate-slide-fade">
                        <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
                        <div>
                            <h4 className="font-bold text-sm uppercase tracking-widest mb-1">Specific documentation not found</h4>
                            <p className="text-sm">We couldn't find a dedicated guide for exactly <code className="bg-amber-100 px-1 rounded font-bold">{new URLSearchParams(window.location.search).get('doc')?.replace('error-', '')}</code>. Displaying the generic troubleshooting steps instead.</p>
                        </div>
                    </div>
                )}

                {/* Article Hero */}
                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
                            {getIconForType(doc.type)}
                        </div>
                        <div className="uppercase tracking-wider text-sm font-bold text-slate-500">
                            {doc.type} Document
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">{doc.title}</h1>
                    <p className="text-xl text-slate-600 leading-relaxed border-l-4 border-slate-300 pl-4 py-1">
                        {doc.summary}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-8">

                        {/* dynamic Body rendered safely */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">What are we looking at?</h2>
                            <div
                                className="prose prose-slate prose-blue max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-a:text-blue-600"
                                dangerouslySetInnerHTML={{
                                    __html: doc.body
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                                        .replace(/\n/g, '<br/>')
                                        .replace(/- (.*?)(?=<br\/>|$)/g, '<li class="ml-4 list-disc">$1</li>')
                                        .replace(/`([^`]+)`/g, '<code class="bg-slate-100 text-slate-800 px-1 py-0.5 rounded text-sm">$1</code>')
                                }}
                            />
                        </div>

                    </div>

                    {/* Right Rail */}
                    <div className="space-y-6">

                        {/* Take Action / Related Actions */}
                        {doc.relatedActions && doc.relatedActions.length > 0 && (
                            <div className="bg-blue-600 rounded-2xl p-6 shadow-sm border border-blue-500 text-white">
                                <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CommandLineIcon className="w-4 h-4 text-blue-200" />
                                    Take Action
                                </h3>
                                <div className="space-y-2.5">
                                    {doc.relatedActions.map((action, i) => (
                                        <a
                                            key={i}
                                            href={action.url}
                                            className="block w-full text-left bg-blue-700/50 hover:bg-blue-800 border border-blue-500 rounded-lg px-4 py-3 text-sm font-medium transition-colors shadow-sm group"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span>{action.label}</span>
                                                <ArrowTopRightOnSquareIcon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Applies To */}
                        {doc.appliesTo && doc.appliesTo.length > 0 && (
                            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Applies To</h3>
                                <div className="flex flex-wrap gap-2">
                                    {doc.appliesTo.map(role => (
                                        <span key={role} className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-1 rounded-md font-medium">
                                            {role}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Thresholds / Status Card */}
                        {(doc.normal || doc.warning || doc.critical) && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Metric Thresholds</h3>
                                <ul className="space-y-3">
                                    {doc.normal && (
                                        <li className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Normal</span>
                                            <span className="font-mono bg-green-50 text-green-700 font-bold px-2 py-1 rounded-md">{doc.normal}</span>
                                        </li>
                                    )}
                                    {doc.warning && (
                                        <li className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Warning</span>
                                            <span className="font-mono bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded-md">{doc.warning}</span>
                                        </li>
                                    )}
                                    {doc.critical && (
                                        <li className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500">Critical</span>
                                            <span className="font-mono bg-red-50 text-red-700 font-bold px-2 py-1 rounded-md">{doc.critical}</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        )}

                        {/* Action Card */}
                        {doc.action && doc.action.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-blue-500">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CommandLineIcon className="w-4 h-4 text-blue-500" />
                                    Recommended Actions
                                </h3>
                                <ul className="space-y-2">
                                    {doc.action.map((act, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-slate-700">
                                            <span className="text-blue-500 font-bold">•</span>
                                            <span>{act}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Meta Card */}
                        <div className="bg-slate-100 rounded-2xl p-5 text-xs text-slate-500">
                            <div className="mb-2"><strong>ID:</strong> `{doc.id}`</div>
                            {doc.lastUpdated && <div><strong>Last updated:</strong> {doc.lastUpdated}</div>}

                            {doc.relatedIds && doc.relatedIds.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200">
                                    <strong className="block mb-2 text-slate-700">Related Articles:</strong>
                                    <div className="space-y-2">
                                        {doc.relatedIds.map(rid => (
                                            <a key={rid} href={`/admin/help?doc=${rid}`} className="block text-blue-600 hover:underline truncate">
                                                {rid}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Feedback Loop */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-center">
                            <h3 className="text-sm font-bold text-slate-900 mb-3">Was this article helpful?</h3>
                            <div className="flex justify-center gap-3 mb-4">
                                <button
                                    onClick={() => postHelpAnalytics({ event_type: 'helpful_yes', article_id: doc.id })}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-green-600 hover:border-green-200 transition-colors">
                                    👍 Yes
                                </button>
                                <button
                                    onClick={() => postHelpAnalytics({ event_type: 'helpful_no', article_id: doc.id })}
                                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-red-600 hover:border-red-200 transition-colors">
                                    👎 No
                                </button>
                            </div>
                            <button
                                onClick={() => postHelpAnalytics({ event_type: 'improvement_suggested', article_id: doc.id })}
                                className="text-xs text-blue-600 hover:underline">
                                Suggest an improvement →
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        </div >
    );
};
