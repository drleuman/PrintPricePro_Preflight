import React, { useState, useRef } from 'react';
import { UploadStepSimple } from '../UploadStepSimple';
import { PreflightDropzone, PreflightDropzoneRef } from '../PreflightDropzone';
import { FileMeta, AppMode } from '../../types';

interface Step1UploadProps {
    file: File | null;
    fileMeta: FileMeta | null;
    onFileSelect: (file: File | null) => void;
    onNext: (mode: AppMode) => void;
    selectedPolicy: string;
    onPolicyChange: (p: string) => void;
}

export const Step1Upload: React.FC<Step1UploadProps> = ({
    file,
    fileMeta,
    onFileSelect,
    onNext,
    selectedPolicy,
    onPolicyChange,
}) => {
    const [selectedMode, setSelectedMode] = useState<'magic' | 'manual'>('magic');
    const [policies, setPolicies] = useState<{ slug: string, name: string }[]>([]);
    const dropzoneRef = useRef<PreflightDropzoneRef>(null);

    React.useEffect(() => {
        fetch('/api/v2/preflight/policies')
            .then(r => r.json())
            .then(res => {
                if (res.ok && res.policies) setPolicies(res.policies);
            })
            .catch(console.error);
    }, []);

    const handlePickFile = () => dropzoneRef.current?.openFileDialog();
    const handleRemoveFile = () => onFileSelect(null);
    const handleContinue = () => {
        const appMode: AppMode = selectedMode === 'magic' ? 'ai' : 'manual';
        onNext(appMode);
    };

    const formatFileSize = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB';

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <UploadStepSimple
                ref={dropzoneRef}
                mode={selectedMode}
                setMode={setSelectedMode}
                fileName={fileMeta?.name}
                fileSizeLabel={fileMeta ? formatFileSize(fileMeta.size) : undefined}
                hasFile={!!file}
                onPickFile={handlePickFile}
                onRemoveFile={handleRemoveFile}
                onFileDrop={onFileSelect}
                onContinue={handleContinue}
                canContinue={!!file}
                selectedPolicy={selectedPolicy}
                onPolicyChange={onPolicyChange}
                policies={policies}
            />
        </div>
    );
};
