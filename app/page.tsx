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
      <h1>Chat with Claude</h1>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
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
      {toolCalls.length > 0 && (
        <section style={{ marginTop: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.4rem' }}>Tools</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {toolCalls.map((t, i) => (
              <li
                key={i}
                style={{
                  padding: '0.4rem 0.7rem',
                  marginBottom: '0.25rem',
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  background: t.status === 'running' ? '#fef3c7' : '#dcfce7',
                  border: `1px solid ${t.status === 'running' ? '#fbbf24' : '#86efac'}`,
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
            padding: '1rem',
            background: '#fafafa',
            border: '1px solid #e5e5e5',
            borderRadius: 6,
            lineHeight: 1.6,
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
