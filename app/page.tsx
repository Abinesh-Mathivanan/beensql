"use client";

import Chat from '../components/Chat';
import { useState } from 'react';

export default function HomePage() {
    const [queryResult, setQueryResult] = useState<any>(null);

    const handleQueryResult = (result: any) => {
        setQueryResult(result);
    };

    return (
        <div>
            <h1>Text to SQL with Gemini</h1>
            <Chat onQueryResult={handleQueryResult} />
            {queryResult && queryResult.result && Array.isArray(queryResult.result) && queryResult.result.length > 0 && (
                <div>
                    <h2>Query Result Description:</h2>
                    <pre>{JSON.stringify(queryResult.resultDescription, null, 2)}</pre>
                    <h2>Generated Query:</h2>
                    <pre>{JSON.stringify(queryResult.query, null, 2)}</pre>
                    <h2>Data Result:</h2>
                    <div className="overflow-x-auto"> {/* Add horizontal scroll if table is too wide */}
                        <table className="min-w-full border-collapse border border-gray-300">
                            <thead>
                                <tr>
                                    {/* Table Headers - extract keys from the first object in result */}
                                    {Object.keys(queryResult.result[0]).map((header) => (
                                        <th key={header} className="border border-gray-300 p-2 bg-gray-100">
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Table Rows - iterate through each object in result array */}
                                {queryResult.result.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        {/* Table Cells - iterate through values of each object (row) */}
                                        {Object.values(row).map((cell, cellIndex) => (
                                            <td key={cellIndex} className="border border-gray-300 p-2 text-sm">
                                                {cell === null ? 'NULL' : String(cell)} {/* Handle null values */}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            {queryResult && queryResult.error && (
                <div>
                    <h2>Error:</h2>
                    <pre className="text-red-500">{JSON.stringify(queryResult.error, null, 2)}</pre>
                </div>
            )}
            {queryResult && queryResult.result && Array.isArray(queryResult.result) && queryResult.result.length === 0 && (
                <div>
                    <h2>Query Result Description:</h2>
                    <pre>{JSON.stringify(queryResult.resultDescription, null, 2)}</pre>
                    <p>No data returned for this query.</p>
                </div>
            )}
        </div>
    );
}