"use client";

import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface UploadResponse {
  message: string;
}

interface ErrorResponse {
  message: string;
}

interface FileUploaderProps {
  onUploadSuccess: (data: UploadResponse) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess }) => {
  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:5000/api/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data: UploadResponse = await response.json();
          onUploadSuccess(data);
        } else {
          const errorData: ErrorResponse = await response.json();
          alert(`File upload failed: ${errorData.message || "Unknown error"}`);
        }
      } catch {
        alert("Error uploading file.");
      }
    },
    [onUploadSuccess]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`dropzone ${isDragActive ? "active" : ""} p-4 border-2 border-dashed rounded-md text-center cursor-pointer`}
    >
      <input {...getInputProps()} name="file" />
      <p>{isDragActive ? "Drop the file here ..." : "Drag & drop a .db, .xlsx, or .csv file here, or click to select one."}</p>
    </div>
  );
};

export default FileUploader;
