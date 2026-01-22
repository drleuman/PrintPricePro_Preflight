import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { t } from '../i18n';
import type { FileMeta } from '../types';

type Props = {
  onDrop: (file: File | null) => void;
};

export const PreflightDropzone: React.FC<Props> = ({ onDrop }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = (file: File | null | undefined) => {
    if (!file) {
      setFileMeta(null);
      onDrop(null);
      return;
    }

    if (file.type !== 'application/pdf') {
      alert(t('invalidFileType'));
      return;
    }

    setFileMeta({ name: file.name, size: file.size, type: file.type });
    onDrop(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  };

  const openFileDialog = () => {
    inputRef.current?.click();
  };

  const borderClass = isDragging ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/70 p-4 sm:px-6 py-6">
      <div
        className={`border-2 border-dashed rounded-xl ${borderClass} flex flex-col items-center justify-center text-center cursor-pointer`}
        style={{ padding: '2rem' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        <div
          className="flex items-center justify-center bg-white border border-gray-300 rounded-full mb-2"
          style={{ width: 56, height: 56 }}
        >
          <span className="text-2xl text-gray-500">☁️</span>
        </div>

        <p className="text-sm text-gray-700 mb-1">{t('dragDropPrompt')}</p>
        <p className="text-xs text-gray-500">
          {fileMeta ? fileMeta.name : 'PDF • max ~50 MB'}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
    </div>
  );
};
