"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface ChatProps {
  onFileUploaded: (filename: string | null) => void;
}

const Chat: React.FC<ChatProps> = ({ onFileUploaded }) => {
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Fetch actual column names from the uploaded file
  const fetchColumns = async (filename: string) => {
    console.log("Fetching columns for:", filename);

    const query = `SELECT name AS column_name FROM pragma_table_info('data');`;
    try {
      const response = await fetch("http://localhost:5000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: query, filename }),
      });
      const data = await response.json();

      if (response.ok && data.result && Array.isArray(data.result)) {
        const colNames = data.result.map((row: any) => row.column_name);
        setColumns(colNames);
      } else {
        console.error("Invalid column response:", data);
        setColumns([]);
      }
    } catch (error) {
      console.error("Error fetching columns:", error);
      setColumns([]);
    }
  };

  // Handle file upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
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
        setFileName(data.filename);
        onFileUploaded(data.filename);

        // Fetch column names
        await fetchColumns(data.filename);
      } else {
        const errorData = await response.json();
        setUploadStatus(
          `File upload failed: ${errorData.message || "Unknown error"}`
        );
        setFileName(null);
        onFileUploaded(null);
        setColumns([]);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadStatus("Error uploading file. Check console.");
      setFileName(null);
      onFileUploaded(null);
      setColumns([]);
    }
  }, [onFileUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
  });

  return (
    <div className="flex flex-col h-full">
      {/* File Upload Area */}
      <div
        {...getRootProps()}
        className={`dropzone ${
          isDragActive ? "active" : ""
        } p-4 border-2 border-dashed rounded-md text-center cursor-pointer mb-2`}
      >
        <input {...getInputProps()} name="file" />
        <p>Upload file</p>
      </div>
      {uploadStatus && (
        <p className="text-sm text-gray-600 mb-4">{uploadStatus}</p>
      )}

      {/* Display Actual Column Names */}
      <div className="border border-gray-300 rounded p-2 flex-grow">
        <h3 className="font-bold mb-2">Columns:</h3>
        {columns.length > 0 ? (
          <ul>
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
