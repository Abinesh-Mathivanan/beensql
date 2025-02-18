"use client";

import { useState } from "react";
import Chat from "../components/Chat";

// 1) Inline ASCII table generator
function generateASCIITable(data: any[]): string {
  if (!data || data.length === 0) {
    return "No rows returned.";
  }

  // Gather columns from the first row
  const columns = Object.keys(data[0]);

  // Determine max width for each column (based on both header and data)
  const colWidths = columns.map((col) => col.length);
  data.forEach((row) => {
    columns.forEach((col, i) => {
      const valStr = row[col] === null ? "NULL" : String(row[col]);
      if (valStr.length > colWidths[i]) {
        colWidths[i] = valStr.length;
      }
    });
  });

  // Helper to build a separator line like +-----+-------+
  const buildSeparator = () => {
    let sep = "+";
    colWidths.forEach((width) => {
      sep += "-".repeat(width + 2) + "+";
    });
    return sep;
  };

  // Build header row
  let output = buildSeparator() + "\n";
  output += "|";
  columns.forEach((col, i) => {
    output += " " + col.padEnd(colWidths[i], " ") + " |";
  });
  output += "\n" + buildSeparator() + "\n";

  // Build each data row
  data.forEach((row) => {
    output += "|";
    columns.forEach((col, i) => {
      const valStr = row[col] === null ? "NULL" : String(row[col]);
      output += " " + valStr.padEnd(colWidths[i], " ") + " |";
    });
    output += "\n";
  });

  // Final bottom separator
  output += buildSeparator();
  return output;
}

export default function HomePage() {
  const [filename, setFilename] = useState<string | null>(null);

  // Chat-like messages: each message is { role: 'user' | 'assistant', content: string }
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);

  // Called by Chat when file is uploaded
  const handleFileUploaded = (file: string | null) => {
    console.log("File uploaded:", file);
    setFilename(file);
  };

  // A helper to run any SQL prompt on the server
  const runQuery = async (prompt: string) => {
    if (!filename) {
      return {
        error: { message: "No file uploaded. Please upload a file first." },
      };
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
      return {
        error: { message: "Error submitting query. Check console." },
      };
    }
  };

  // 1) "Show column names" button at the top
  const handleShowColumnNames = async () => {
    // Add a user message for clarity
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Show column names" },
    ]);

    if (!filename) {
      const msg = "No file uploaded. Please upload a file first.";
      console.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: msg },
      ]);
      return;
    }

    try {
      console.log("Fetching columns for filename:", filename);
      // Call dedicated endpoint to get column names
      const response = await fetch(
        `http://localhost:5000/api/columns?filename=${encodeURIComponent(
          filename
        )}`
      );
      const data = await response.json();
      console.log("Response from /api/columns:", data);

      let output = "";
      if (
        response.ok &&
        data.columns &&
        Array.isArray(data.columns) &&
        data.columns.length > 0
      ) {
        // Prepare tableData as one object with keys = column names and values = column names
        const tableData = [
          data.columns.reduce((acc: any, col: string) => {
            acc[col] = col;
            return acc;
          }, {}),
        ];
        output = generateASCIITable(tableData);
      } else {
        output = "No columns found or empty result.";
        console.error("Columns endpoint returned empty:", data);
      }
      // Add an assistant message with the column names
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: output },
      ]);
    } catch (error) {
      console.error("Error fetching columns:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error fetching column names." },
      ]);
    }
  };

  // 2) Handling user’s custom query (the bottom prompt)
  const [prompt, setPrompt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // 2a) Add a user message immediately
    const userMessage = prompt;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    // 2b) Run the query
    const result = await runQuery(prompt);

    let output = "";
    if (result.error) {
      output = `Error: ${JSON.stringify(result.error, null, 2)}`;
    } else if (Array.isArray(result.result) && result.result.length > 0) {
      // Build ASCII table
      output = generateASCIITable(result.result);
    } else if (Array.isArray(result.result) && result.result.length === 0) {
      output = "No data returned for this query.";
    } else {
      // Might be some other structure
      output = JSON.stringify(result, null, 2);
    }

    // 2c) Add an assistant message with the result
    setMessages((prev) => [...prev, { role: "assistant", content: output }]);

    // Clear the prompt
    setPrompt("");
  };

  return (
    <div className="min-h-screen bg-[#F5F5DC] text-gray-900 flex">
      {/* Left column: file upload */}
      <div className="w-1/3 border-r border-gray-300 p-4">
        <Chat onFileUploaded={handleFileUploaded} />
      </div>

      {/* Right column */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Top: "show the column names" button */}
        <div className="mb-4">
          <button
            className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
            onClick={handleShowColumnNames}
          >
            show the column names
          </button>
        </div>

        {/* Middle: scrollable "chat" area */}
        <div className="flex-1 border border-gray-300 rounded p-4 bg-white overflow-auto">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-4 ${
                msg.role === "assistant" ? "text-blue-600" : "text-black"
              }`}
            >
              <pre className="whitespace-pre-wrap">{msg.content}</pre>
            </div>
          ))}
        </div>

        {/* Bottom: query input (purple border + arrow button) */}
        <div className="mt-4">
          <form onSubmit={handleSubmit} className="flex">
            <input
              type="text"
              placeholder="Enter your query"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-grow p-2 border border-purple-500 focus:outline-none rounded-l"
            />
            <button
              type="submit"
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold p-2 rounded-r"
            >
              ➔
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
