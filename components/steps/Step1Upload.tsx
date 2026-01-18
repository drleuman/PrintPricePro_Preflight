import React, { useState } from 'react';
import { PreflightDropzone } from '../PreflightDropzone';
import { FileMeta, AppMode } from '../../types';
import { SparklesIcon, AdjustmentsHorizontalIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface Step1UploadProps {
    file: File | null;
    fileMeta: FileMeta | null;
    onFileSelect: (file: File | null) => void;
    onNext: (mode: AppMode) => void;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
    file,
    fileMeta,
    onFileSelect,
    onNext,
}) => {
    const [selectedMode, setSelectedMode] = useState<AppMode>(null);

    return (
        <div className="step step--upload animate-fade-in">
            <div className="step__header">
                <h2 className="step__title text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    Upload Your PDF
                </h2>
                <p className="step__description text-lg text-gray-500 mt-2">
                    Start by uploading the PDF you want to prepare for printing
                </p>
            </div>

            <div className="step__content space-y-8">
                <PreflightDropzone onDrop={onFileSelect} />

                {fileMeta && (
                    <div className="animate-slide-in">
                        <div className="file-info bg-blue-50 border-blue-100 p-4 rounded-2xl flex items-center gap-4 transition-all hover:shadow-md">
                            <div className="file-info__icon text-4xl">📄</div>
                            <div className="file-info__details">
                                <div className="file-info__name font-bold text-gray-900">{fileMeta.name}</div>
                                <div className="file-info__size text-gray-500 font-medium">
                                    {(fileMeta.size / (1024 * 1024)).toFixed(2)} MB
                                </div>
                            </div>
                            <div className="ml-auto">
                                <CheckCircleIcon className="w-8 h-8 text-green-500" />
                            </div>
                        </div>

                        <div className="mt-12 max-w-4xl mx-auto">
                            <h3 className="text-2xl font-black text-gray-900 text-center mb-10 tracking-tight">
                                Choose Your Workflow Efficiency
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* AI Fix Mode */}
                                <div
                                    onClick={() => setSelectedMode('ai')}
                                    className={`mode-card mode-card--ai ${selectedMode === 'ai' ? 'mode-card--active' : ''}`}
                                >
                                    <div className="mode-card__check">
                                        <CheckCircleIcon className="w-10 h-10" />
                                    </div>
                                    <div className="mode-card__icon-wrapper">
                                        <SparklesIcon className="w-10 h-10" />
                                    </div>
                                    <h4 className="mode-card__title">Magic AI Fix</h4>
                                    <p className="mode-card__description">
                                        Our AI agent performs deep analysis and automatically prepares your file with high-res images and correct color spaces.
                                    </p>
                                    <div className="mode-card__badge">
                                        <SparklesIcon className="w-5 h-5 animate-pulse" />
                                        <span>Recommended Path</span>
                                    </div>
                                </div>

                                {/* Manual Fix Mode */}
                                <div
                                    onClick={() => setSelectedMode('manual')}
                                    className={`mode-card mode-card--manual ${selectedMode === 'manual' ? 'mode-card--active' : ''}`}
                                >
                                    <div className="mode-card__check">
                                        <CheckCircleIcon className="w-10 h-10" />
                                    </div>
                                    <div className="mode-card__icon-wrapper">
                                        <AdjustmentsHorizontalIcon className="w-10 h-10" />
                                    </div>
                                    <h4 className="mode-card__title">Manual Control</h4>
                                    <p className="mode-card__description">
                                        Maintain full control over every optimization. Analyze results and choose specific fixes for your professional needs.
                                    </p>
                                    <div className="mode-card__badge">
                                        <span>Pro Professional</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="step__actions mt-12 pt-8 border-t border-gray-100 flex justify-center">
                <button
                    className={`btn btn--large px-12 py-5 text-xl rounded-2xl shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${selectedMode === 'ai'
                            ? 'btn--magic'
                            : 'bg-gray-900 text-white hover:bg-black'
                        } disabled:opacity-20 disabled:scale-100`}
                    onClick={() => onNext(selectedMode)}
                    disabled={!file || !selectedMode}
                >
                    <span>{selectedMode === 'ai' ? 'Start Magic Fix ✨' : 'Proceed to Analysis →'}</span>
                </button>
            </div>
        </div>
    );
};
