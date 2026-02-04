import React from 'react';
import {
    DocumentTextIcon,
    MagnifyingGlassIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline';

interface Step {
    number: number;
    title: string;
    icon: string;
}

interface StepperProps {
    currentStep: number;
    steps: Step[];
}

const getStepIcon = (stepNumber: number) => {
    switch (stepNumber) {
        case 1:
            return DocumentTextIcon;
        case 2:
            return MagnifyingGlassIcon;
        case 3:
            return WrenchScrewdriverIcon;
        case 4:
            return CheckCircleIcon;
        case 5:
            return BanknotesIcon;
        default:
            return DocumentTextIcon;
    }
}

export const Stepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
    return (
        <div className="mb-10 px-8 py-10 bg-white/60 backdrop-blur-xl rounded-[2.5rem] border border-white/40 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="relative flex items-center justify-between max-w-5xl mx-auto">

                {/* Connector Lines Layer */}
                <div className="absolute top-[35px] left-0 right-0 h-[2px] bg-gray-100 -z-10 mx-12 hidden md:block" />

                {steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;

                    return (
                        <div key={step.number} className="flex-1 relative group">
                            {/* Animated Connector Line */}
                            {index < steps.length - 1 && (
                                <div className={`absolute top-[35px] left-[calc(50%+40px)] w-[calc(100%-80px)] h-[2px] transition-all duration-1000 -z-10 hidden md:block ${isCompleted ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gray-100'
                                    }`}>
                                    {isCompleted && <div className="absolute inset-0 bg-white/30 animate-shimmer" />}
                                </div>
                            )}

                            <div className="flex flex-col items-center">
                                {/* The Circle */}
                                <div className={`
                                    relative w-[70px] h-[70px] rounded-[2rem] flex items-center justify-center transition-all duration-500 mb-4
                                    ${isCompleted
                                        ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-xl shadow-emerald-200/50 scale-90'
                                        : isActive
                                            ? 'bg-blue-600 text-white shadow-2xl shadow-blue-500/40 scale-110 -translate-y-1'
                                            : 'bg-white text-gray-300 border-2 border-gray-100 group-hover:border-gray-200'
                                    }
                                `}>
                                    {isActive && (
                                        <div className="absolute inset-0 rounded-[2rem] bg-blue-500 blur-xl opacity-40 animate-pulse" />
                                    )}

                                    <div className="relative z-10 transition-transform duration-500 group-hover:scale-110">
                                        {isCompleted ? (
                                            <CheckCircleIcon className="h-10 w-10 font-black" />
                                        ) : (
                                            <StepIcon className="h-8 w-8" />
                                        )}
                                    </div>

                                    {/* Number Badge */}
                                    <div className={`
                                        absolute -top-1 -right-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black
                                        ${isActive ? 'bg-red-500 text-white' : isCompleted ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}
                                    `}>
                                        {step.number}
                                    </div>
                                </div>

                                {/* Label */}
                                <div className="text-center">
                                    <div className={`
                                        text-[10px] font-black uppercase tracking-[0.2em] mb-1 transition-colors duration-500
                                        ${isActive ? 'text-blue-600' : isCompleted ? 'text-emerald-500' : 'text-gray-400'}
                                    `}>
                                        Step 0{step.number}
                                    </div>
                                    <div className={`
                                        text-sm font-black tracking-tight transition-all duration-500
                                        ${isActive ? 'text-gray-900 scale-105' : 'text-gray-400'}
                                    `}>
                                        {step.title}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite linear;
                }
            `}</style>
        </div>
    );
};
