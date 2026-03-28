import React from 'react';
import {
    DocumentArrowUpIcon,
    MagnifyingGlassCircleIcon,
    WrenchScrewdriverIcon,
    ShieldCheckIcon,
} from '@heroicons/react/24/outline';

interface Step {
    number: number;
    title: string;
    description?: string;
}

interface StepperProps {
    currentStep: number;
    steps: Step[];
}

const getStepIcon = (stepNumber: number) => {
    switch (stepNumber) {
        case 1: return DocumentArrowUpIcon;
        case 2: return MagnifyingGlassCircleIcon;
        case 3: return WrenchScrewdriverIcon;
        case 4: return ShieldCheckIcon;
        default: return DocumentArrowUpIcon;
    }
};

export const Stepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
    return (
        <div className="w-full">
            <div className="flex flex-row items-center justify-between gap-6 relative no-scrollbar">
                {steps.map((step, idx) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;

                    return (
                        <div key={step.number} className="flex-1 flex items-center gap-4 group min-w-max">
                            {/* Step Indicator - Compacted for Header */}
                            <div className={`
                                relative flex h-8 w-8 shrink-0 items-center justify-center border transition-all duration-500
                                ${isActive 
                                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)] text-white shadow-[0_0_20px_rgba(220,0,0,0.3)]' 
                                    : isCompleted 
                                        ? 'border-[var(--accent-color)]/40 bg-[var(--bg-tertiary)] text-[var(--accent-color)]' 
                                        : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-dim)]'}
                            `}>
                                <StepIcon className="h-3.5 w-3.5" />
                                {isActive && (
                                    <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-white animate-pulse rounded-full border border-[var(--accent-color)]" />
                                )}
                            </div>

                            {/* Text Guidance - Ultra-compact */}
                            <div className="hidden lg:block">
                                <div className={`
                                    ppp-phase-tag !text-[0.8rem] transition-colors duration-500 whitespace-nowrap
                                    ${isActive ? 'text-[var(--text-primary)]' : isCompleted ? 'text-[var(--text-primary)]/80' : 'text-[var(--text-dim)]'}
                                `}>
                                    {step.title}
                                </div>
                            </div>

                            {/* Chevron separator for flow */}
                            {idx < steps.length - 1 && (
                                <div className="ml-auto flex items-center pr-2">
                                    <div className={`h-1.5 w-1.5 rotate-45 border-t border-r ${isCompleted ? 'border-[var(--accent-color)]/40' : 'border-[var(--border-color)]'}`} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
