"use client";

import { useState } from "react";
import Chat from "../components/Chat";

export default function HomePage() {
  const [filename, setFilename] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [prompt, setPrompt] = useState("");

  const handleFileUploaded = (file: string | null) => {
    setFilename(file);
  };

  const runQuery = async (prompt: string) => {
    if (!filename) {
      return { error: { message: "No file uploaded. Please upload a file first." } };
    }
    try {
      const response = await fetch("http://localhost:5000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, filename }),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error submitting query:", error);
      return { error: { message: "Error submitting query. Check console." } };
    }
  };

  const handleShowColumnNames = async () => {
    setMessages((prev) => [...prev, { role: "user", content: "Show column names" }]);

    if (!filename) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "No file uploaded. Please upload a file first." },
      ]);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/columns?filename=${encodeURIComponent(filename)}`,
        { method: "GET" }
      );
      const data = await response.json();

      const output =
        response.ok && data.columns && Array.isArray(data.columns) && data.columns.length > 0
          ? "Available Columns:\n" + data.columns.join(", ")
          : "No columns found or empty result.";

      setMessages((prev) => [...prev, { role: "assistant", content: output }]);
    } catch (error) {
      console.error("Error fetching columns:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Error fetching column names." }]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    const result = await runQuery(prompt);
    const output =
      result.error ? `Error: ${JSON.stringify(result.error, null, 2)}` : result.result || result.resultDescription || JSON.stringify(result, null, 2);

    setMessages((prev) => [...prev, { role: "assistant", content: output }]);
    setPrompt("");
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5DC] text-gray-900 overflow-x-hidden">
      <div className="w-1/3 border-r border-gray-300 p-4 sticky top-0 h-screen overflow-hidden">
        <Chat onFileUploaded={handleFileUploaded} />
      </div>

      <div className="flex-1 flex flex-col h-screen overflow-x-hidden">
        <div className="p-4">
          <button className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300" onClick={handleShowColumnNames}>
            show the column names
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-white border border-gray-300 rounded">
          {messages.map((msg, idx) => (
            <div key={idx} className="mb-4">
              {msg.role === "assistant" ? (
                <div className="border p-2 w-full" style={{ overflowX: "auto" }}>
                  <pre className="whitespace-pre text-sm">{msg.content}</pre>
                </div>
              ) : (
                <pre className="whitespace-pre text-sm">{msg.content}</pre>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-[#F5F5DC] p-4 border-t border-gray-300">
          <form onSubmit={handleSubmit} className="flex">
            <input
              type="text"
              placeholder="Enter your query"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-grow p-2 border border-purple-500 focus:outline-none rounded-l"
            />
            <button type="submit" className="bg-purple-500 hover:bg-purple-600 text-white font-bold p-2 rounded-r">
              ➔
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
