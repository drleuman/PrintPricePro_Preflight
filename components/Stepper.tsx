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
        <div style={{
            marginBottom: '20px',
            padding: '24px 30px',
            background: 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '40px',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
            width: '100%'
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                maxWidth: '1000px',
                margin: '0 auto',
                position: 'relative'
            }}>
                {steps.map((step, index) => {
                    const StepIcon = getStepIcon(step.number);
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;

                    return (
                        <React.Fragment key={step.number}>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                flex: 1,
                                position: 'relative',
                                zIndex: 2
                            }}>
                                {/* Circle */}
                                <div style={{
                                    width: '70px',
                                    height: '70px',
                                    borderRadius: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                    marginBottom: '15px',
                                    position: 'relative',
                                    background: isCompleted
                                        ? 'linear-gradient(135deg, #10b981, #059669)'
                                        : isActive
                                            ? 'linear-gradient(135deg, #dc0000, #b90000)'
                                            : '#fff',
                                    color: (isCompleted || isActive) ? '#fff' : '#d1d5db',
                                    border: (isCompleted || isActive) ? 'none' : '2px solid #f3f4f6',
                                    boxShadow: isActive ? '0 15px 30px rgba(220, 0, 0, 0.3)' : 'none',
                                    transform: isActive ? 'scale(1.1) translateY(-5px)' : 'scale(1)'
                                }}>
                                    {isActive && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: '-4px',
                                            borderRadius: '28px',
                                            border: '2px solid #dc0000',
                                            opacity: 0.3
                                        }} />
                                    )}
                                    {isCompleted ? (
                                        <CheckCircleIcon style={{ width: '36px', height: '36px' }} />
                                    ) : (
                                        <StepIcon style={{ width: '30px', height: '30px' }} />
                                    )}

                                    {/* Small Number Badge */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '-8px',
                                        right: '-8px',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: isActive ? '#ef4444' : isCompleted ? '#10b981' : '#f3f4f6',
                                        color: (isActive || isCompleted) ? '#fff' : '#9ca3af',
                                        fontSize: '11px',
                                        fontWeight: 900,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '3px solid #fff',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                                    }}>
                                        {step.number}
                                    </div>
                                </div>

                                {/* Label */}
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{
                                        fontSize: '10px',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        marginBottom: '4px',
                                        color: isActive ? '#dc0000' : isCompleted ? '#10b981' : '#9ca3af'
                                    }}>
                                        Step 0{step.number}
                                    </div>
                                    <div style={{
                                        fontSize: '14px',
                                        fontWeight: 800,
                                        color: isActive ? '#111827' : '#9ca3af',
                                        letterSpacing: '-0.3px'
                                    }}>
                                        {step.title}
                                    </div>
                                </div>
                            </div>

                            {/* Line between steps */}
                            {index < steps.length - 1 && (
                                <div style={{
                                    flex: 0.5,
                                    height: '4px',
                                    background: isCompleted ? '#10b981' : '#f3f4f6',
                                    margin: '0 10px',
                                    borderRadius: '2px',
                                    position: 'relative',
                                    top: '-20px'
                                }}>
                                    {isCompleted && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
                                            animation: 'shimmer 2s infinite linear'
                                        }} />
                                    )}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
            <style>{`
                @keyframes shimmer {
                    from { transform: translateX(-100%); }
                    to { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
};
