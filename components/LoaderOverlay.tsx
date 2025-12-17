import React, { useEffect, useState } from 'react';

type Props = {
    isOpen: boolean;
    message?: string;
};

const LOADING_TIPS = [
    "Please wait, this may take a moment...",
    "Optimizing your document structure...",
    "Applying industry-standard fixes...",
    "Ensuring print-ready quality...",
    "Almost there, finalizing output..."
];

export const LoaderOverlay: React.FC<Props> = ({ isOpen, message = 'Processing...' }) => {
    const [tipIndex, setTipIndex] = useState(0);

    useEffect(() => {
        if (!isOpen) {
            setTipIndex(0);
            return;
        }
        const interval = setInterval(() => {
            setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full mx-4 animate-fadeIn">
                {/* Spinner */}
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>

                {/* Text */}
                <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Processing
                    </h3>
                    <p className="text-sm text-gray-500 font-medium">
                        {message}
                    </p>
                    <p className="text-xs text-gray-400 mt-2 h-4 transition-opacity duration-300">
                        {LOADING_TIPS[tipIndex]}
                    </p>
                </div>
            </div>
        </div>
    );
};
