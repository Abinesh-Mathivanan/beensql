"use client";

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface ChatProps {
    onQueryResult: (result: any) => void; // Callback to pass query results to parent
}

const Chat: React.FC<ChatProps> = ({ onQueryResult }) => {
    const [prompt, setPrompt] = useState('');
    const [filename, setFilename] = useState<string | null>(null);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null); // To display upload status

    const onDrop = useCallback(async (acceptedFiles) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploadStatus('Uploading...'); // Indicate upload start
        setFilename(null); // Reset filename on new upload attempt

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:5000/api/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const data = await response.json();
                setFilename(data.filename); // Store filename after successful upload
                setUploadStatus(`File "${data.filename}" uploaded successfully.`);
            } else {
                const errorData = await response.json();
                console.error('File upload failed:', errorData);
                setUploadStatus(`File upload failed: ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            setUploadStatus('Error uploading file. Check console.');
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            alert("Please enter your query prompt.");
            return;
        }
        if (!filename) {
            alert("Please upload a file first.");
            setUploadStatus('Please upload a file to start chatting.');
            return;
        }
        setUploadStatus('Processing query...'); // Indicate query processing

        try {
            const response = await fetch('http://localhost:5000/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt, filename: filename }),
            });
            const data = await response.json();
            if (response.ok) {
                onQueryResult(data); // Pass query result to parent component
                setUploadStatus('Query processed successfully.');
            } else {
                console.error("Query error:", data);
                setUploadStatus(`Query failed: ${data.message || 'Unknown error'}`);
                onQueryResult({ error: data }); // Pass error to parent as well
            }
        } catch (error) {
            console.error("Error submitting query:", error);
            setUploadStatus('Error submitting query. Check console.');
            onQueryResult({ error: { message: 'Error submitting query. Check console.' } });
        } finally {
            setPrompt(''); // Clear prompt input after submission (success or failure)
        }
    };

    return (
        <div className="mt-4">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} p-4 border-2 border-dashed rounded-md text-center cursor-pointer mb-2`}>
                <input {...getInputProps()} name="file" />
                {isDragActive ? (
                    <p>Drop the file here ...</p>
                ) : (
                    <p>Drag 'n' drop a database (.db), Excel (.xlsx), or CSV file here, or click to select file to chat with</p>
                )}
            </div>
            {uploadStatus && <p className="text-sm text-gray-600 mb-2">{uploadStatus}</p>}

            <form onSubmit={handleSubmit} className="flex">
                <input
                    type="text"
                    placeholder="Enter your query prompt related to the uploaded data..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="flex-grow p-2 border rounded-l-md focus:outline-none"
                />
                <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold p-2 rounded-r-md"
                >
                    Ask Gemini
                </button>
            </form>
        </div>
    );
};

export default Chat;