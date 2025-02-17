"use client"; // Add this line at the very top

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileUploaderProps {
    onUploadSuccess: (data: any) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess }) => {
    interface UploadResponse {
        message: string;
    }

    interface ErrorResponse {
        message: string;
    }

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:5000/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json() as UploadResponse;
                onUploadSuccess(data);
            } else {
                const errorData = await response.json() as ErrorResponse;
                console.error('File upload failed:', errorData);
                alert(`File upload failed: ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error uploading file. Check console.');
        }
    }, [onUploadSuccess]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

    return (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} p-4 border-2 border-dashed rounded-md text-center cursor-pointer`}>
            <input {...getInputProps()} name="file" />
            {isDragActive ? (
                <p>Drop the file here ...</p>
            ) : (
                <p>Drag 'n' drop a database (.db), Excel (.xlsx), or CSV file here, or click to select file</p>
            )}
        </div>
    );
};

export default FileUploader;