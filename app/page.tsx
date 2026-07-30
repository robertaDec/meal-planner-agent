'use client'

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if(!message.trim() || loading) return;
    setLoading(true);
    setResponse('');

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message}),
    });
    if(!res.body){
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      const chunk = decoder.decode(value);
      setResponse((prev) => prev + chunk);
    }
    setLoading(false);

    }
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '1rem' }}>
      <h1>Chat with Claude</h1>
      <textarea
      value={message}
      onChange={(e)=> setMessage(e.target.value)}
      placeholder="Ask something"
      rows={3}
      style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
      />
      <button
      onClick={handleSubmit}
      disabled={loading || !message.trim()}
      style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}
      >
        {loading ? 'Thinking...' : 'Send'}
      </button>
    {response && (
      <div style={{ marginTop: '1.5rem', whiteSpace: 'pre-wrap' }}>
         {response}
      </div>
    )}
    </main>
  );
}