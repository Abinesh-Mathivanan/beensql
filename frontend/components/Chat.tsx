"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface ChatProps {
  onFileUploaded: (filename: string | null) => void;
}

const Chat: React.FC<ChatProps> = ({ onFileUploaded }) => {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);

  const fetchColumns = async (filename: string) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/columns?filename=${encodeURIComponent(filename)}`,
        { method: "GET" }
      );
      const data = await response.json();

      if (response.ok && data.columns && Array.isArray(data.columns)) {
        setColumns(data.columns);
      } else {
        setColumns([]);
      }
    } catch {
      setColumns([]);
    }
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploadStatus("Uploading...");
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:5000/api/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setUploadStatus(`File "${data.filename}" uploaded successfully.`);
          onFileUploaded(data.filename);
          await fetchColumns(data.filename);
        } else {
          const errorData = await response.json();
          setUploadStatus(`File upload failed: ${errorData.message || "Unknown error"}`);
          onFileUploaded(null);
          setColumns([]);
        }
      } catch {
        setUploadStatus("Error uploading file.");
        onFileUploaded(null);
        setColumns([]);
      }
    },
    [onFileUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  return (
    <div className="flex flex-col h-full">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? "active" : ""} p-4 border-2 border-dashed rounded-md text-center cursor-pointer mb-2`}
      >
        <input {...getInputProps()} name="file" />
        <p>Upload file (csv or excel)</p>
      </div>
      {uploadStatus && <p className="text-sm text-gray-600 mb-4">{uploadStatus}</p>}
      <div className="border border-gray-300 rounded p-2 flex-grow overflow-x-auto">
        <h3 className="font-bold mb-2">Columns:</h3>
        {columns.length > 0 ? (
          <ul className="min-w-max">
            {columns.map((col, index) => (
              <li key={index}>{col}</li>
            ))}
          </ul>
        ) : (
          <p>No columns found.</p>
        )}
      </div>
    </div>
  );
};

export default Chat;
