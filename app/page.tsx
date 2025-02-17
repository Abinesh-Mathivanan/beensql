"use client";

import Chat from '../components/Chat';
import { useState } from 'react';

export default function HomePage() {
    const [queryResult, setQueryResult] = useState<any>(null);

    const handleQueryResult = (result: any) => {
        setQueryResult(result); // Update queryResult state with the result from Chat
    };

    return (
        <div>
            <h1>Text to SQL with Gemini</h1>
            <Chat onQueryResult={handleQueryResult} /> {/* Pass handleQueryResult to Chat */}
            {queryResult && queryResult.result && ( // Check if result and result.result exist
                <div>
                    <h2>Query Result Description:</h2>
                    <pre>{JSON.stringify(queryResult.resultDescription, null, 2)}</pre>
                    <h2>Generated Query:</h2>
                    <pre>{JSON.stringify(queryResult.query, null, 2)}</pre>
                    <h2>Data Result:</h2>
                    <pre>{JSON.stringify(queryResult.result, null, 2)}</pre>
                </div>
            )}
            {queryResult && queryResult.error && ( // Handle error case
                <div>
                    <h2>Error:</h2>
                    <pre className="text-red-500">{JSON.stringify(queryResult.error, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}