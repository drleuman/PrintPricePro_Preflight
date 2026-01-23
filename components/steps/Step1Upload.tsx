import React, { useState, useRef } from 'react';
import { UploadStepSimple } from '../UploadStepSimple';
import { PreflightDropzone, PreflightDropzoneRef } from '../PreflightDropzone';
import { FileMeta, AppMode } from '../../types';

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
    const [selectedMode, setSelectedMode] = useState<'magic' | 'manual'>('magic'); // Default to 'magic'
    const dropzoneRef = useRef<PreflightDropzoneRef>(null);

    const handlePickFile = () => {
        dropzoneRef.current?.openFileDialog();
    };

    const handleRemoveFile = () => {
        onFileSelect(null);
    };

    const handleContinue = () => {
        const appMode: AppMode = selectedMode === 'magic' ? 'ai' : 'manual';
        onNext(appMode);
    };

    const formatFileSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(1)} MB`;
    };

    return (
        <div className="step step--upload animate-fade-in">
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
            />
        </div>
    );
};
