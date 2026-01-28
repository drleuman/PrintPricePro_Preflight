import React, { useState } from 'react';
import { BookPriceForm } from '../Pricing/BookPriceForm';
import { AssistantChat } from '../Pricing/AssistantChat';
import { BookConfig, QuoteOffer, FileMeta } from '../../types';
import { useEffect } from 'react';

interface Step5QuoteProps {
    fileMeta?: FileMeta | null;
    numPages?: number;
    onBack: () => void;
    onStartOver: () => void;
}

const Icon = {
    Target: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    Refresh: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    ArrowLeft: (p: { className?: string }) => (
        <svg className={p.className} viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5m7 7l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
};

export const Step5Quote: React.FC<Step5QuoteProps> = ({
    fileMeta,
    numPages,
    onBack,
    onStartOver,
}) => {
    const [config, setConfig] = useState<BookConfig>({
        pages_interior: 0,
        cover_pages: 4,
        pms_interior: 0,
        pms_cover: 0,
        cover_print_rev: 1,
        format: 'A5 (148 x 210 mm)',
        paper_interior: 'Standard White 80lb',
        paper_cover: 'Coated Silk 100lb',
        quantity: 500,
    });

    // Auto-fill from preflight results if available
    useEffect(() => {
        if (numPages && numPages > 0) {
            setConfig(prev => ({ ...prev, pages_interior: numPages }));
        }
    }, [numPages]);

    const [selectedOffer, setSelectedOffer] = useState<QuoteOffer | null>(null);

    const handleSelectOffer = (offer: QuoteOffer) => {
        setSelectedOffer(offer);
        window.alert(`Selection Confirmed: ${offer.title} (${offer.price})\n\nA representative will contact you soon.`);
    };

    return (
        <div className="step step--quote animate-fade-in">
            <div className="step__header">
                <h2 className="step__title">Get a Custom Quote</h2>
                <p className="step__description">
                    Adjust your book specifications and chat with our AI assistant to find the best pricing for your project.
                </p>
            </div>

            <div className="step__content grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <BookPriceForm
                        config={config}
                        onChange={setConfig}
                    />

                    {selectedOffer && (
                        <div className="bg-green-50 border-2 border-green-500 rounded-2xl p-6 flex items-center gap-4 animate-bounce">
                            <div className="text-3xl text-green-600">
                                <Icon.Target className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="font-bold text-green-900">Selected: {selectedOffer.title}</h4>
                                <p className="text-green-700 text-sm">Price: {selectedOffer.price} - We've saved this for your order.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <AssistantChat
                        config={config}
                        onSelectOffer={handleSelectOffer}
                    />
                </div>
            </div>

            <div className="step__actions">
                <button className="btn btn--secondary flex items-center gap-2" onClick={onBack}>
                    <Icon.ArrowLeft className="h-4 w-4" /> Back to Review
                </button>
                <button className="btn btn--outline flex items-center gap-2" onClick={onStartOver}>
                    <Icon.Refresh className="h-4 w-4" /> Start Over
                </button>
            </div>
        </div>
    );
};
