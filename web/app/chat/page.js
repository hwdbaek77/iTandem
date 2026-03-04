"use client";

import { useState, useEffect, useRef } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import {
  findUserByEmail,
  getOrCreateConversation,
  sendMessage,
  subscribeToConversations,
  subscribeToMessages,
} from "../../lib/messaging";

const QUICK_MESSAGES = [
  "I'm here",
  "On my way",
  "Running late",
  "Leaving now",
  "Need 5 min",
  "Car moved",
];

export default function ChatPage() {
  const { user, profile } = useAuth();

  // Conversation list state
  const [conversations, setConversations] = useState([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchStatus, setSearchStatus] = useState({ text: "", type: "" });

  // Active chat state
  const [activeConv, setActiveConv] = useState(null); // { id, otherName, otherUid }
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const myName = profile?.name || user?.email || "Me";

  // Subscribe to conversation list
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToConversations(db, user.uid, (convs) => {
      setConversations(convs);
      setConvsLoading(false);
    });
    return unsub;
  }, [user]);

  // Subscribe to messages when a conversation is active
  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToMessages(db, activeConv.id, setMessages);
    return unsub;
  }, [activeConv]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleStartChat(e) {
    e?.preventDefault();
    const email = searchEmail.trim().toLowerCase();
    if (!email) return;
    if (email === user.email?.toLowerCase()) {
      setSearchStatus({ text: "You cannot message yourself.", type: "error" });
      return;
    }
    setSearchStatus({ text: "Looking up user…", type: "info" });
    try {
      const other = await findUserByEmail(db, email);
      if (!other) {
        setSearchStatus({ text: "No iTandem account found with that email.", type: "error" });
        return;
      }
      const convId = await getOrCreateConversation(
        db, user.uid, other.uid, myName, other.name || other.email
      );
      setSearchEmail("");
      setSearchStatus({ text: "", type: "" });
      setActiveConv({ id: convId, otherName: other.name || other.email, otherUid: other.uid });
    } catch (err) {
      setSearchStatus({ text: "Error: " + err.message, type: "error" });
    }
  }

  async function handleSend(overrideText) {
    const text = (overrideText ?? messageText).trim();
    if (!text || !activeConv || sending) return;
    if (!overrideText) setMessageText("");
    setSending(true);
    try {
      await sendMessage(db, activeConv.id, user.uid, myName, text);
    } catch (err) {
      alert("Failed to send: " + err.message);
    } finally {
      setSending(false);
    }
  }

  function openConversation(conv) {
    const otherUid = conv.participants?.find((p) => p !== user.uid);
    const otherName = conv.participantNames?.[otherUid] || "Unknown";
    setActiveConv({ id: conv.id, otherName, otherUid });
  }

  // ────────────────────────────────────────────
  // Chat view
  // ────────────────────────────────────────────
  if (activeConv) {
    return (
      <AppShell>
        {/* Back header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setActiveConv(null)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-card transition-colors hover:bg-white/10"
            aria-label="Back to conversations"
          >
            <BackArrow />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{activeConv.otherName}</h2>
            <p className="text-xs text-muted">Direct message</p>
          </div>
        </div>

        {/* Message bubbles */}
        <div
          className="rounded-3xl bg-card p-4 mb-4 overflow-y-auto flex flex-col gap-2"
          style={{ minHeight: "320px", maxHeight: "320px" }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              No messages yet — say hi!
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === user.uid;
              const time = msg.createdAt
                ? new Date(msg.createdAt.toMillis()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm break-words ${
                      isMine
                        ? "bg-accent text-white rounded-br-sm"
                        : "bg-white/10 text-white rounded-bl-sm"
                    }`}
                  >
                    <p>{msg.text}</p>
                    {time && (
                      <p className={`text-[10px] mt-1 ${isMine ? "text-white/55" : "text-muted"}`}>
                        {time}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick messages */}
        <div className="mb-3">
          <p className="text-xs text-muted mb-2">Quick messages</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_MESSAGES.map((qm) => (
              <button
                key={qm}
                onClick={() => handleSend(qm)}
                disabled={sending}
                className="rounded-full border border-white/10 bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                {qm}
              </button>
            ))}
          </div>
        </div>

        {/* Text input */}
        <div className="flex gap-2 items-center">
          <input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-white placeholder:text-muted outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={!messageText.trim() || sending}
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
      </AppShell>
    );
  }

  // ────────────────────────────────────────────
  // Conversation list view
  // ────────────────────────────────────────────
  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Messages</h2>
      <p className="mt-2 mb-6 text-base text-muted">
        Chat with your tandem and carpool partners.
      </p>

      {/* Start new chat */}
      <form onSubmit={handleStartChat} className="flex gap-2 mb-2">
        <input
          type="email"
          value={searchEmail}
          onChange={(e) => {
            setSearchEmail(e.target.value);
            setSearchStatus({ text: "", type: "" });
          }}
          placeholder="Start a chat by email…"
          className="flex-1 rounded-2xl border border-white/10 bg-card px-4 py-3 text-sm text-white placeholder:text-muted outline-none focus:border-accent transition-colors"
        />
        <button
          type="submit"
          disabled={!searchEmail.trim()}
          className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          aria-label="Start chat"
        >
          <PlusIcon />
        </button>
      </form>

      {searchStatus.text && (
        <p
          className={`mb-4 text-sm ${
            searchStatus.type === "error" ? "text-red-400" : "text-accent"
          }`}
        >
          {searchStatus.text}
        </p>
      )}

      {/* Conversation list */}
      <section className="mt-2">
        {convsLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5 text-3xl">
              💬
            </div>
            <h3 className="font-semibold mb-1">No conversations yet</h3>
            <p className="text-sm text-muted">
              Enter a teammate&apos;s email above to start chatting.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const otherUid = conv.participants?.find((p) => p !== user.uid);
              const otherName = conv.participantNames?.[otherUid] || "Unknown";
              const initial = otherName.charAt(0).toUpperCase();
              const lastTime = conv.lastMessageAt
                ? new Date(conv.lastMessageAt.toMillis()).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className="w-full rounded-3xl bg-card p-4 text-left transition-colors hover:bg-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 font-bold text-accent">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-semibold text-sm">{otherName}</p>
                        <p className="flex-shrink-0 text-xs text-muted">{lastTime}</p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {conv.lastMessage || "No messages yet"}
                      </p>
                    </div>
                    <ChevronRight />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

// ── Icons ──────────────────────────────────────

function BackArrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden="true">
      <path
        d="M9 18l6-6-6-6"
        stroke="#6B7280"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
