import React from 'react';
import {
    DocumentTextIcon,
    MagnifyingGlassIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
    BanknotesIcon
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';

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
        case 1: return DocumentTextIcon;
        case 2: return MagnifyingGlassIcon;
        case 3: return WrenchScrewdriverIcon;
        case 4: return CheckCircleIcon;
        case 5: return BanknotesIcon;
        default: return DocumentTextIcon;
    }
}

export const Stepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
    return (
        <div className="w-full mb-8 px-6 py-8 bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.04)]">
            <div className="max-w-4xl mx-auto flex items-center justify-between relative">
                {/* Background Progress Track */}
                <div className="absolute top-7 left-0 w-full h-[2px] bg-gray-100 -z-10" />

                {/* Active Progress Line */}
                <div
                    className="absolute top-7 left-0 h-[2px] bg-red-600 transition-all duration-700 ease-in-out -z-10"
                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;
                    const isPending = currentStep < step.number;

                    return (
                        <div key={step.number} className="flex flex-col items-center relative group">
                            {/* Step Indicator */}
                            <div className={`
                                w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500
                                ${isCompleted ? 'bg-green-500 text-white shadow-lg shadow-green-200' :
                                    isActive ? 'bg-red-600 text-white shadow-xl shadow-red-200 scale-110 -translate-y-1' :
                                        'bg-white text-gray-400 border-2 border-gray-100'}
                            `}>
                                {isCompleted ? (
                                    <CheckIcon className="w-8 h-8 animate-in zoom-in duration-300" />
                                ) : (
                                    <StepIcon className={`w-7 h-7 ${isActive ? 'animate-pulse' : ''}`} />
                                )}

                                {/* Small Number Badge (Only when pending) */}
                                {isPending && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-100 text-[10px] font-black flex items-center justify-center border-2 border-white text-gray-400">
                                        {step.number}
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <div className="mt-4 text-center">
                                <div className={`
                                    text-[10px] font-black uppercase tracking-widest mb-1 transition-colors duration-300
                                    ${isActive ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}
                                `}>
                                    Step 0{step.number}
                                </div>
                                <div className={`
                                    text-sm font-bold tracking-tight transition-colors duration-300
                                    ${isActive ? 'text-gray-900' : 'text-gray-400'}
                                `}>
                                    {step.title}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
