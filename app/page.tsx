'use client';

import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  type ToolCall = {
    name: string;
    status: 'running' | 'done';
    summary?: string;
  };

  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  async function handleSubmit() {
    if (!message.trim() || loading) return;
    setLoading(true);
    setResponse('');
    setToolCalls([]);
    setError(null);

    const res = await fetch('/api/chat/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (!res.body) {
      setLoading(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const raw of events) {
        const line = raw.trim();
        if (!line.startsWith('data:')) continue;

        const json = line.slice(5).trim();
        if (!json) continue;

        try {
          const event = JSON.parse(json);
          if (event.type === 'text') {
            setResponse((prev) => prev + event.delta);
          } else if (event.type === 'tool_start') {
            setToolCalls((prev) => [...prev, { name: event.name, status: 'running' }]);
          } else if (event.type === 'tool_result') {
            setToolCalls((prev) => {
              const next = [...prev];
              for (let i = next.length - 1; i >= 0; i--) {
                if (next[i].name === event.name && next[i].status === 'running') {
                  next[i] = { ...next[i], status: 'done', summary: event.summary };
                  break;
                }
              }
              return next;
            });
          } else if (event.type === 'error') {
            setError(event.message);
          }
        } catch (err) {
          console.error('failed to parse event:', json, err);
        }
      }
      setLoading(false);
    }
  }
  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '1rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 600,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Meal Planner
        </h1>
        <p
          style={{
            margin: '0.5rem 0 0',
            color: '#78716c',
            fontSize: '1rem',
          }}
        >
          Cook with what is already in the kitchen.
        </p>
      </header>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="What is a quick dinner idea?"
        rows={3}
        style={{
          width: '100%',
          padding: '0.75rem 0.9rem',
          fontSize: '1rem',
          fontFamily: 'inherit',
          border: '1px solid #d6d3d1',
          borderRadius: 8,
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none',
          lineHeight: 1.5,
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !message.trim()}
        style={{
          marginTop: '0.75rem',
          padding: '0.6rem 1.25rem',
          fontSize: '0.95rem',
          fontWeight: 500,
          background: loading || !message.trim() ? '#a8a29e' : '#1c1917',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: loading || !message.trim() ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s ease',
        }}
      >
        {loading ? 'Thinking...' : 'Ask'}
      </button>
      {toolCalls.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.4rem' }}>Tools</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {toolCalls.map((t, i) => (
              <li
                key={i}
                style={{
                  padding: '0.5rem 0.8rem',
                  marginBottom: '0.35rem',
                  borderRadius: 8,
                  fontSize: '0.9rem',
                  background: t.status === 'running' ? '#fef9c3' : '#f0fdf4',
                  color: t.status === 'running' ? '#854d0e' : '#166534',
                  border: `1px solid ${t.status === 'running' ? '#fde68a' : '#bbf7d0'}`,
                  transition: 'background 0.2s ease, color 0.2s ease, border 0.2s ease',
                }}
              >
                <strong>{t.name}</strong>
                {' · '}
                {t.status === 'running' ? 'running…' : t.summary}
              </li>
            ))}
          </ul>
        </section>
      )}
      {response && (
        <div
          style={{
            marginTop: '1.5rem',
            whiteSpace: 'pre-wrap',
            padding: '1.25rem',
            background: 'white',
            border: '1px solid #e7e5e4',
            borderRadius: 10,
            lineHeight: 1.65,
            fontSize: '1rem',
            color: '#1c1917',
          }}
        >
          {response}
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', color: '#b91c1c', fontSize: '0.9rem' }}>
          Error: {error}
        </div>
      )}
    </main>
  );
}
