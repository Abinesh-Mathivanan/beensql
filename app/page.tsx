"use client";

import { useState } from "react";
import Chat from "../components/Chat";

// Modified ASCII table generator that accepts an optional header parameter.
function generateASCIITable(data: any[], header?: string[]): string {
  if (!data || data.length === 0) {
    return "No rows returned.";
  }

  let columns: string[];
  if (header && header.length > 0) {
    columns = header;
  } else if (typeof data[0] === "object" && !Array.isArray(data[0])) {
    // When rows are objects, use their keys.
    columns = Object.keys(data[0]);
  } else if (Array.isArray(data[0])) {
    // If no header provided, use default names.
    columns = data[0].map((_, i) => `Column ${i + 1}`);
  } else {
    return "Unable to determine columns.";
  }

  // Determine maximum width for each column.
  const colWidths = columns.map((col) => col.length);
  data.forEach((row) => {
    if (Array.isArray(row)) {
      row.forEach((cell, i) => {
        const cellStr = cell === null ? "NULL" : String(cell);
        if (cellStr.length > colWidths[i]) {
          colWidths[i] = cellStr.length;
        }
      });
    } else {
      columns.forEach((col, i) => {
        const cellStr = row[col] === null ? "NULL" : String(row[col]);
        if (cellStr.length > colWidths[i]) {
          colWidths[i] = cellStr.length;
        }
      });
    }
  });

  // Helper function to build a separator.
  const buildSeparator = () => {
    let sep = "+";
    colWidths.forEach((width) => {
      sep += "-".repeat(width + 2) + "+";
    });
    return sep;
  };

  let output = buildSeparator() + "\n";
  // Build header row.
  output += "|";
  columns.forEach((col, i) => {
    output += " " + col.padEnd(colWidths[i], " ") + " |";
  });
  output += "\n" + buildSeparator() + "\n";

  // Build each data row.
  data.forEach((row) => {
    output += "|";
    if (Array.isArray(row)) {
      row.forEach((cell, i) => {
        const cellStr = cell === null ? "NULL" : String(cell);
        output += " " + cellStr.padEnd(colWidths[i], " ") + " |";
      });
    } else {
      columns.forEach((col, i) => {
        const cellStr = row[col] === null ? "NULL" : String(row[col]);
        output += " " + cellStr.padEnd(colWidths[i], " ") + " |";
      });
    }
    output += "\n";
  });
  output += buildSeparator();
  return output;
}

export default function HomePage() {
  const [filename, setFilename] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [prompt, setPrompt] = useState("");

  // Called by Chat when file is uploaded.
  const handleFileUploaded = (file: string | null) => {
    setFilename(file);
  };

  // Helper to run any SQL prompt on the server.
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

  // "Show column names" button functionality.
  const handleShowColumnNames = async () => {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Show column names" },
    ]);

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

      let output = "";
      if (
        response.ok &&
        data.columns &&
        Array.isArray(data.columns) &&
        data.columns.length > 0
      ) {
        // Create a table using the column names (single-row table).
        const tableData = [data.columns];
        output = generateASCIITable(tableData, data.columns);
      } else {
        output = "No columns found or empty result.";
      }
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

  // Handle user query submission.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Add a user message immediately.
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);

    const result = await runQuery(prompt);
    let output = "";
    if (result.error) {
      output = `Error: ${JSON.stringify(result.error, null, 2)}`;
    } else if (Array.isArray(result.result) && result.result.length > 0) {
      let transformedData = result.result;
      let headerForTable = result.columns;
      // If there's exactly one row and multiple columns, assume they're all of the same type.
      if (
        result.result.length === 1 &&
        typeof result.result[0] === "object" &&
        !Array.isArray(result.result[0]) &&
        result.columns &&
        result.columns.length > 1
      ) {
        const row = result.result[0];
        // Use Object.values(row) to get the values in insertion order.
        const values = Object.values(row);
        const verticalData = [];
        // Iterate over the number of meta names provided.
        for (let i = 0; i < result.columns.length; i++) {
          const metaName = result.columns[i];
          const value = values[i];
          // Only include if value is defined.
          if (value !== undefined && value !== null) {
            verticalData.push({ "Meta Data": metaName, "Value": value });
          }
        }
        if (verticalData.length > 0) {
          transformedData = verticalData;
          headerForTable = ["Meta Data", "Value"];
        }
      }
      output = generateASCIITable(transformedData, headerForTable);
    } else if (Array.isArray(result.result) && result.result.length === 0) {
      output = "No data returned for this query.";
    } else {
      output = JSON.stringify(result, null, 2);
    }
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: output },
    ]);
    setPrompt("");
  };

  return (
    <div className="min-h-screen flex bg-[#F5F5DC] text-gray-900">
      {/* Left Sidebar: Fixed and non-scrollable */}
      <div className="w-1/3 border-r border-gray-300 p-4 sticky top-0 h-screen overflow-hidden">
        <Chat onFileUploaded={handleFileUploaded} />
      </div>

      {/* Right Column */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Top: "Show column names" button */}
        <div className="p-4">
          <button
            className="px-4 py-2 border rounded bg-gray-200 hover:bg-gray-300"
            onClick={handleShowColumnNames}
          >
            show the column names
          </button>
        </div>

        {/* Middle: Chat messages area (scrollable) */}
        <div className="flex-1 overflow-auto p-4 bg-white border border-gray-300 rounded">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-4 ${msg.role === "assistant" ? "text-blue-600" : "text-black"}`}
            >
              <pre className="whitespace-pre-wrap">{msg.content}</pre>
            </div>
          ))}
        </div>

        {/* Bottom: Query input bar (floating at the bottom) */}
        <div className="sticky bottom-0 bg-[#F5F5DC] p-4 border-t border-gray-300">
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
