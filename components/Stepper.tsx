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
        <div className="stepper">
            <div className="stepper__container">
                {steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;

                    return (
                        <React.Fragment key={step.number}>
                            <div className={`stepper__step ${isActive ? 'stepper__step--active' : ''} ${isCompleted ? 'stepper__step--completed' : ''}`}>
                                <div className="stepper__step-circle">
                                    {isCompleted ? (
                                        <CheckCircleIcon className="stepper__icon" />
                                    ) : (
                                        <StepIcon className="stepper__icon" />
                                    )}
                                </div>
                                <div className="stepper__step-label">
                                    <div className="stepper__step-number">Step {step.number}</div>
                                    <div className="stepper__step-title">{step.title}</div>
                                </div>
                            </div>
                            {index < steps.length - 1 && (
                                <div className={`stepper__line ${isCompleted ? 'stepper__line--completed' : ''}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
