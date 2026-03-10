import React from 'react';
import {
    DocumentTextIcon,
    MagnifyingGlassIcon,
    WrenchScrewdriverIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { t } from '../i18n';

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
        default: return DocumentTextIcon;
    }
};

export const Stepper: React.FC<StepperProps> = ({ currentStep, steps }) => {
    const progressPct = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div style={{
            width: '100%',
            marginBottom: '2rem',
            padding: '2rem 1.5rem',
            background: 'rgba(255,255,255,0.70)',
            backdropFilter: 'blur(20px)',
            borderRadius: '2rem',
            border: '1px solid rgba(255,255,255,0.5)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
        }}>
            <div style={{
                maxWidth: '56rem',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
            }}>
                {/* Background track */}
                <div style={{
                    position: 'absolute', top: '1.75rem', left: '1.75rem',
                    width: 'calc(100% - 3.5rem)', height: '2px',
                    background: '#f3f4f6', zIndex: 0,
                }} />
                {/* Active progress line */}
                <div style={{
                    position: 'absolute', top: '1.75rem', left: '1.75rem',
                    width: `calc(${progressPct}% * (100% - 3.5rem) / 100%)`, height: '2px',
                    background: '#dc2626',
                    transition: 'width 0.7s ease-in-out', zIndex: 0,
                }} />

                {steps.map((step) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;
                    const isPending = currentStep < step.number;

                    const bubbleStyle: React.CSSProperties = {
                        position: 'relative',
                        width: '3.5rem', height: '3.5rem',
                        borderRadius: '1rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1,
                        transition: 'all 0.5s',
                        flexShrink: 0,
                        ...(isCompleted ? {
                            background: '#22c55e', color: '#fff',
                            boxShadow: '0 8px 20px rgba(34,197,94,0.3)',
                        } : isActive ? {
                            background: '#dc2626', color: '#fff',
                            boxShadow: '0 8px 24px rgba(220,38,38,0.35)',
                            transform: 'scale(1.10) translateY(-4px)',
                        } : {
                            background: '#fff', color: '#9ca3af',
                            border: '2px solid #f3f4f6',
                        }),
                    };

                    return (
                        <div key={step.number} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                            <div style={bubbleStyle}>
                                {isCompleted ? (
                                    <CheckIcon style={{ width: '2rem', height: '2rem' }} />
                                ) : (
                                    <StepIcon style={{ width: '1.75rem', height: '1.75rem' }} />
                                )}
                                {isPending && (
                                    <div style={{
                                        position: 'absolute', top: '-4px', right: '-4px',
                                        width: '1.25rem', height: '1.25rem',
                                        borderRadius: '50%', background: '#f3f4f6',
                                        fontSize: '10px', fontWeight: 900,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        border: '2px solid #fff', color: '#9ca3af',
                                    }}>
                                        {step.number}
                                    </div>
                                )}
                            </div>

                            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                                <div
                                    style={{
                                        fontSize: '10px',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        marginBottom: '2px',
                                        color: isActive ? '#dc2626' : isCompleted ? '#16a34a' : '#9ca3af',
                                        transition: 'color 0.3s',
                                    }}
                                >
                                    {t('stepNumber', { number: step.number })}
                                </div>
                                <div style={{
                                    fontSize: '0.875rem', fontWeight: 700,
                                    color: isActive ? '#111827' : '#9ca3af',
                                    transition: 'color 0.3s',
                                }}>
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
