import { useState } from 'react';
import { api } from '../utils/api.js';

const SUGGESTIONS = [
  'What is the single biggest risk?',
  'Why might margins be under pressure?',
  'Who is the most dangerous competitor?',
  'What would you recommend to the CEO?',
];

// Read a Server-Sent Events stream, invoking onEvent(name, data) per block.
async function consumeSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop();
    for (const block of blocks) {
      let event = 'message';
      const dataLines = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) {
        try {
          onEvent(event, JSON.parse(dataLines.join('\n')));
        } catch {
          /* ignore */
        }
      }
    }
  }
}

// Grounded Q&A on a completed analysis, streamed token-by-token. Messages persist
// in the tab state.
export default function FollowUpChat({ query, buildContext, chat, onChat }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(question) {
    const q = question.trim();
    if (!q || loading) return;
    const prior = chat; // chat before this exchange (stable for this call)
    const history = prior.slice(-6);
    onChat([...prior, { role: 'user', text: q }, { role: 'assistant', text: '' }]);
    setInput('');
    setLoading(true);

    let acc = '';
    let errMsg = '';
    try {
      const res = await fetch(api('/api/followup/stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context: buildContext(), question: q, history }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Server error ${res.status}`);
      }
      await consumeSSE(res, (event, data) => {
        if (event === 'token') {
          acc += data.token;
          onChat([...prior, { role: 'user', text: q }, { role: 'assistant', text: acc }]);
        } else if (event === 'error') {
          errMsg = data.error || 'Follow-up failed.';
        }
      });
      const final = acc || (errMsg ? `⚠️ ${errMsg}` : '(no answer)');
      onChat([...prior, { role: 'user', text: q }, { role: 'assistant', text: final }]);
    } catch (err) {
      onChat([
        ...prior,
        { role: 'user', text: q },
        { role: 'assistant', text: acc || `⚠️ ${err.message || 'Something went wrong.'}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat" aria-label="Ask a follow-up">
      <h3 className="chat-title">💬 Ask a follow-up</h3>

      {chat.length === 0 && !loading && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" className="chat-chip" onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {chat.length > 0 && (
        <div className="chat-thread">
          {chat.map((m, i) => (
            <div key={i} className={`chat-msg chat-msg--${m.role}`}>
              {m.text || (m.role === 'assistant' && loading ? <span className="chat-cursor">▍</span> : '')}
            </div>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this analysis…"
          disabled={loading}
        />
        <button className="analyze-btn" type="submit" disabled={loading || !input.trim()}>
          Ask
        </button>
      </form>
    </section>
  );
}
