"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";

const EMOTES = [
  { emoji: "I'm here", label: "Arrived" },
  { emoji: "On my way", label: "On my way" },
  { emoji: "Running late", label: "Running late" },
  { emoji: "Leaving now", label: "Leaving now" },
  { emoji: "Need 5 min", label: "Need 5 min" },
  { emoji: "Car moved", label: "Car moved" },
];

export default function ChatPage() {
  const [sent, setSent] = useState(null);

  function handleSend(emote) {
    setSent(emote.label);
    setTimeout(() => setSent(null), 2000);
  }

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Messages</h2>
      <p className="mt-2 text-base text-muted">
        Send quick status updates to your tandem partner.
      </p>

      {/* Quick Emotes */}
      <section className="mt-6">
        <h3 className="text-lg font-semibold mb-3">Quick Messages</h3>
        <div className="grid grid-cols-2 gap-2">
          {EMOTES.map((emote) => (
            <button
              key={emote.label}
              onClick={() => handleSend(emote)}
              className="rounded-2xl bg-card p-4 text-center transition-all hover:bg-white/10 active:scale-95"
            >
              <span className="block text-sm font-semibold">{emote.emoji}</span>
            </button>
          ))}
        </div>

        {sent && (
          <div className="mt-4 rounded-xl bg-green-500/10 border border-green-500/30 px-4 py-3 text-center">
            <p className="text-sm text-green-400">
              &quot;{sent}&quot; sent to your partner!
            </p>
          </div>
        )}
      </section>

      {/* Conversation Placeholder */}
      <section className="mt-6 rounded-3xl bg-card p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-xl">
          M
        </div>
        <h3 className="font-semibold mb-1">Full Chat Coming Soon</h3>
        <p className="text-sm text-muted">
          Direct messaging with your tandem and carpool partners is being built. 
          For now, use quick messages above to coordinate.
        </p>
      </section>

      <div className="mt-4 text-center">
        <Link
          href="/carpool"
          className="text-sm text-accent hover:underline"
        >
          Find a tandem partner first
        </Link>
      </div>
    </AppShell>
  );
}
