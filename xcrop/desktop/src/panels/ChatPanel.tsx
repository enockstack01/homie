import { useEffect, useRef, useState } from "react";
import { api, type ChatTurn } from "../lib/api";

interface Props {
  runId: string | null;
  hasApiKey: boolean;
  // Lets another panel (ResultsPanel's "Explain this analysis" quick action) inject and
  // send a message from outside. nonce changes on every request so the same text can be
  // sent twice in a row and still trigger the effect below.
  seed?: { text: string; nonce: number } | null;
}

export function ChatPanel({ runId, hasApiKey, seed }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<{ deducted: number; remaining: number } | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastSeedNonce = useRef<number | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  useEffect(() => {
    if (!seed || seed.nonce === lastSeedNonce.current) return;
    lastSeedNonce.current = seed.nonce;
    void send(seed.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setInput("");
    const nextMessages: ChatTurn[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const result = await api.chat(nextMessages, runId ?? undefined);
      setMessages([...nextMessages, { role: "assistant", content: result.reply }]);
      setCredits({ deducted: result.deducted_credits, remaining: result.remaining_credits });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void send(input);
  }

  return (
    <section className="panel chat-panel">
      <h2>Ask xcrop</h2>
      {!hasApiKey && <p className="hint">Set a Homie API key above to chat.</p>}

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="hint">
            {runId
              ? "Ask about this run, or anything else - agronomy, climate, how the tool works."
              : "Ask a general question, or run an analysis first to discuss its results."}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "chat-bubble chat-user" : "chat-bubble chat-assistant"}>
            {m.content}
          </div>
        ))}
        {sending && <div className="chat-bubble chat-assistant chat-pending">Thinking...</div>}
      </div>

      {error && <p className="error">{error}</p>}
      {credits && (
        <p className="hint">
          {credits.deducted} credits used - {credits.remaining} remaining
        </p>
      )}

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Ask a question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!hasApiKey || sending}
        />
        <button type="submit" disabled={!hasApiKey || sending || !input.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}
