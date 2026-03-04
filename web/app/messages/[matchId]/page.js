"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../../components/AppShell";
import Link from "next/link";
import { api } from "../../../lib/api";

/**
 * Dedicated messages page for an active tandem or carpool match.
 * Navigate here when user taps an active match card.
 */
export default function MessagesPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId;
  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getMyMatches().catch(() => ({ matches: [] })),
      api.getMessages(matchId).catch(() => []),
    ])
      .then(([matchesRes, messagesRes]) => {
        const m = (matchesRes.matches || []).find((x) => x.id === matchId);
        if (!m || m.status !== "active") {
          setError("Match not found or not active");
          setMatch(null);
          return;
        }
        setMatch(m);
        setMessages(messagesRes.messages || messagesRes);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [matchId]);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.sendMessage(matchId, text);
      setDraft("");
      const res = await api.getMessages(matchId);
      setMessages(res.messages || res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (!matchId) {
    return (
      <AppShell>
        <p className="text-muted">Invalid match</p>
        <Link href="/tandem" className="mt-4 text-accent">Back to Tandem</Link>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell>
        <div className="py-12 text-center text-muted">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Loading messages...
        </div>
      </AppShell>
    );
  }

  if (error || !match) {
    return (
      <AppShell>
        <p className="text-red-400">{error || "Match not found"}</p>
        <Link href="/tandem" className="mt-4 inline-block text-accent">Back to Tandem</Link>
      </AppShell>
    );
  }

  const otherId = match.direction === "sent" ? match.targetId : match.requesterId;
  const backHref = match.type === "carpool" ? "/carpool" : "/tandem";

  async function handleUnmatch() {
    if (!confirm("End this match? You will both go back on the market.")) return;
    setUnmatching(true);
    try {
      await api.unmatch(matchId);
      router.push(backHref);
    } catch (err) {
      setError(err.message);
    } finally {
      setUnmatching(false);
    }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href={backHref} className="text-accent text-sm font-medium">
          ← Back
        </Link>
        <h2 className="text-xl font-bold flex-1 text-center">
          {match.type === "carpool" ? "Carpool" : "Tandem"} Messages
        </h2>
        <button
          onClick={handleUnmatch}
          disabled={unmatching}
          className="text-xs text-red-400 hover:underline disabled:opacity-50 shrink-0"
        >
          {unmatching ? "Ending..." : "End match"}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/50 min-h-[200px] max-h-[50vh] overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.senderId === otherId ? "bg-white/5 ml-0 mr-8" : "bg-accent/20 ml-8 mr-0"
              }`}
            >
              <span className="text-xs text-muted block mb-0.5">
                {m.senderId === otherId ? "Them" : "You"}
              </span>
              {m.text}
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-white/15 bg-background px-4 py-2.5 text-sm text-white outline-none focus:border-accent"
        />
        <button
          onClick={sendMessage}
          disabled={!draft.trim() || sending}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {sending ? "..." : "Send"}
        </button>
      </div>
    </AppShell>
  );
}
