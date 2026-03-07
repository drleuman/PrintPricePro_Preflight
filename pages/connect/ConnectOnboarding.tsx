import React, { useState } from 'react';
import {
    BuildingOfficeIcon,
    CpuChipIcon,
    Square3Stack3DIcon,
    BoltIcon,
    ChevronRightIcon,
    ChevronLeftIcon,
    CheckIcon
} from '@heroicons/react/24/outline';

export const ConnectOnboarding = ({ onComplete }: { onComplete: (data: any) => void }) => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        legal_name: '',
        website: '',
        country: '',
        city: '',
        contactName: '',
        contactEmail: ''
    });

    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-6">
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Company Information</h3>
                            <p style={{ color: '#6b7280', fontSize: '14px' }}>Let's start with your legal identity and location.</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Public Name</label>
                                <input
                                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }}
                                    placeholder="e.g. London Print Experts"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Legal Name</label>
                                <input
                                    style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }}
                                    placeholder="London Print Experts Ltd"
                                    value={formData.legal_name}
                                    onChange={e => setFormData({ ...formData, legal_name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>Primary Contact Email</label>
                            <input
                                style={{ padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }}
                                placeholder="technical@print-experts.co.uk"
                                value={formData.contactEmail}
                                onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <CpuChipIcon className="w-16 h-16 mx-auto mb-6 text-indigo-500 opacity-20" />
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Machine Registry</h3>
                        <p style={{ color: '#6b7280', marginBottom: '32px' }}>In Step 2, you'll select your machine profiles from our global registry.</p>
                        <div style={{ padding: '20px', border: '1px solid #e5e7eb', borderRadius: '16px', background: '#f9fafb', color: '#9ca3af', fontSize: '13px' }}>
                            Interactive Machine Selector will appear after identity verification.
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <Square3Stack3DIcon className="w-16 h-16 mx-auto mb-6 text-indigo-500 opacity-20" />
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Materials & Paper</h3>
                        <p style={{ color: '#6b7280', marginBottom: '32px' }}>Declare supported paper profiles and grammages.</p>
                    </div>
                );
            case 4:
                return (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <BoltIcon className="w-16 h-16 mx-auto mb-6 text-indigo-500 opacity-20" />
                        <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>Production Capacity</h3>
                        <p style={{ color: '#6b7280', marginBottom: '32px' }}>Initialize your availability snapshots for the next 7 days.</p>
                    </div>
                );
        }
    };

    return (
        <div style={{
            maxWidth: '800px', margin: '60px auto', background: 'white', borderRadius: '32px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', overflow: 'hidden'
        }}>
            <div style={{
                padding: '32px 48px', borderBottom: '1px solid #f3f4f6', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc'
            }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{
                            width: '32px', height: '6px', borderRadius: '3px',
                            background: i <= step ? '#111827' : '#e5e7eb'
                        }} />
                    ))}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px' }}>
                    Step {step} of 4
                </div>
            </div>

            <div style={{ padding: '48px' }}>
                {renderStep()}
            </div>

            <div style={{ padding: '32px 48px', background: '#fafbfc', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between' }}>
                <button
                    disabled={step === 1}
                    onClick={() => setStep(s => s - 1)}
                    style={{
                        opacity: step === 1 ? 0 : 1,
                        padding: '12px 24px', borderRadius: '16px', border: '1px solid #e5e7eb',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                    }}
                >
                    <ChevronLeftIcon className="w-4 h-4" /> Back
                </button>
                <button
                    onClick={() => step < 4 ? setStep(s => s + 1) : onComplete(formData)}
                    style={{
                        padding: '12px 32px', borderRadius: '16px', border: 'none',
                        background: '#111827', color: 'white', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
                    }}
                >
                    {step === 4 ? 'Complete Onboarding' : 'Next'} <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
