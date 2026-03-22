'use client';

import { UploadCloud } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

type DocumentUploaderProps = {
  isUploading: boolean;
  progress: number;
  onUpload: (docType: string, file: File) => Promise<void>;
};

export function DocumentUploader({ isUploading, progress, onUpload }: DocumentUploaderProps) {
  const [docType, setDocType] = useState('death_certificate');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState('');

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setLocalError('');
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setLocalError('Please select a file first.');
      return;
    }

    setLocalError('');
    await onUpload(docType, selectedFile);
    setSelectedFile(null);
  };

  return (
    <div className="document-uploader">
      <div className="inventory-form-grid">
        <Input label="Document Type" value={docType} onChange={(event) => setDocType(event.target.value)} required />
        <Input label="Document File" type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} required />
      </div>

      {localError ? <p className="input-error-msg">{localError}</p> : null}

      {isUploading ? (
        <div className="upload-progress">
          <div className="upload-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="input-helper-msg">Uploading {progress}%</p>
        </div>
      ) : null}

      <Button type="button" onClick={() => void handleSubmit()} isLoading={isUploading}>
        <UploadCloud size={16} /> Upload and Scan
      </Button>
    </div>
  );
}
