import { useState } from 'react';

const SUGGESTIONS = [
  'What is the single biggest risk?',
  'Why might margins be under pressure?',
  'Who is the most dangerous competitor?',
  'What would you recommend to the CEO?',
];

// Grounded Q&A on a completed analysis. Messages persist in the tab state.
export default function FollowUpChat({ query, buildContext, chat, onChat }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function ask(question) {
    const q = question.trim();
    if (!q || loading) return;
    const history = chat.slice(-6);
    const withUser = [...chat, { role: 'user', text: q }];
    onChat(withUser);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context: buildContext(), question: q, history }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `Server error ${res.status}`);
      onChat([...withUser, { role: 'assistant', text: d.answer }]);
    } catch (err) {
      onChat([...withUser, { role: 'assistant', text: `⚠️ ${err.message || 'Something went wrong.'}` }]);
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
            <div key={i} className={`chat-msg chat-msg--${m.role}`}>{m.text}</div>
          ))}
          {loading && <div className="chat-msg chat-msg--assistant chat-typing">Thinking…</div>}
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
