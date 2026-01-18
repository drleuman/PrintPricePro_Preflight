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
                            <div className="text-3xl text-green-600">🎯</div>
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
                <button className="btn btn--secondary" onClick={onBack}>
                    ← Back to Review
                </button>
                <button className="btn btn--outline" onClick={onStartOver}>
                    🔄 Start Over
                </button>
            </div>
        </div>
    );
};
