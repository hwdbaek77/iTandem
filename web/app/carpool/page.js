"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function CarpoolPage() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noSchedule, setNoSchedule] = useState(false);
  const [myMatchStates, setMyMatchStates] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [messageLists, setMessageLists] = useState({});
  const [messaging, setMessaging] = useState({});

  useEffect(() => {
    Promise.all([
      api.getRankedMatches("carpool").catch((err) => {
        if (err.message?.includes("haven't uploaded") || err.message?.includes("schedule")) {
          setNoSchedule(true);
        }
        return { matches: [] };
      }),
      api.getMyMatches().catch(() => ({ matches: [] })),
    ])
      .then(([ranked, mine]) => {
        setMatches(ranked.matches || []);
        const state = {};
        (mine.matches || []).forEach((m) => {
          const otherId = m.direction === "sent" ? m.targetId : m.requesterId;
          const key = matchKey({ userId: otherId, type: m.type });
          state[key] = { ...m, userId: otherId };
        });
        setMyMatchStates(state);
      })
      .finally(() => setLoading(false));
  }, []);

  // Carpool scoring: weight schedule compatibility but focus on departure alignment
  const carpoolMatches = useMemo(() => {
    return (
      matches
        ?.filter((m) => m.compatible)
        .map((m) => ({
          ...m,
          carpoolScore: Math.round(m.score * 0.6 + (m.dayAverage || 0) * 0.4),
        }))
        .sort((a, b) => b.carpoolScore - a.carpoolScore) || []
    );
  }, [matches]);

  function matchKey(match) {
    return `${match.userId || match.name || "unknown"}:${match.type || "carpool"}`;
  }

  async function handleRequest(match) {
    const userId = match.userId;
    if (!userId) return alert("Missing user id for match");
    try {
      const res = await api.sendMatchRequest(userId, "carpool");
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ ...match, userId })]: {
          requesterId: "me",
          targetId: userId,
          status: res.status || "pending",
          type: "carpool",
          direction: "sent",
          id: res.matchId,
        },
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAccept(state, matchId) {
    try {
      await api.acceptMatch(matchId);
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ userId: state.userId, type: state.type })]: { ...state, status: "active" },
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDecline(state, matchId) {
    try {
      await api.declineMatch(matchId);
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ userId: state.userId, type: state.type })]: { ...state, status: "declined" },
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  async function loadMessages(matchId) {
    if (!matchId) return;
    setMessaging((p) => ({ ...p, [matchId]: true }));
    try {
      const res = await api.getMessages(matchId);
      setMessageLists((p) => ({ ...p, [matchId]: res.messages || [] }));
    } finally {
      setMessaging((p) => ({ ...p, [matchId]: false }));
    }
  }

  async function sendMessage(matchId) {
    const text = messageDrafts[matchId]?.trim();
    if (!text) return;
    setMessaging((p) => ({ ...p, [matchId]: true }));
    try {
      await api.sendMessage(matchId, text);
      setMessageDrafts((p) => ({ ...p, [matchId]: "" }));
      await loadMessages(matchId);
    } catch (err) {
      alert(err.message);
    } finally {
      setMessaging((p) => ({ ...p, [matchId]: false }));
    }
  }

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Carpool</h2>
      <p className="mt-2 text-base text-muted">
        Find students with similar schedules and routes to share rides.
      </p>

      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Finding carpool matches...
        </div>
      )}

      {!loading && noSchedule && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
            S
          </div>
          <p className="text-sm text-muted mb-4">
            Upload your schedule to find carpool partners with compatible times.
          </p>
          <Link
            href="/profile"
            className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Upload Schedule
          </Link>
        </div>
      )}

      {!loading && !noSchedule && carpoolMatches?.length === 0 && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <p className="text-sm text-muted">
            No carpool matches found yet. Check back as more students upload their schedules!
          </p>
        </div>
      )}

      {/* Carpool factors info */}
      {!loading && !noSchedule && (
        <section className="mt-4 rounded-3xl bg-card p-4">
          <p className="text-xs text-muted">
            Carpool matching factors: schedule alignment, arrival/departure times, extracurricular commitments, and grade level.
            Location-based matching is coming soon.
          </p>
        </section>
      )}

      {!loading && carpoolMatches?.length > 0 && (
        <section className="mt-4 space-y-3">
          {carpoolMatches.map((match, idx) => (
            <div key={match.userId || match.name} className="rounded-3xl bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                    {match.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{match.name}</h3>
                    <p className="text-xs text-muted">
                      Schedule match {match.score}/100
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-lg font-bold ${
                    match.carpoolScore >= 60 ? "text-green-400" :
                    match.carpoolScore >= 35 ? "text-yellow-400" : "text-muted"
                  }`}>
                    #{idx + 1}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {(() => {
                  const state = myMatchStates[matchKey(match)];
                  if (state?.status === "active") {
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-green-400">Matched! You can message now.</p>
                        <Link
                          href={`/messages/${state.id}`}
                          className="inline-block rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
                        >
                          Open messages →
                        </Link>
                        <div className="rounded-2xl border border-white/10 p-3 space-y-2">
                          <div className="flex gap-2">
                            <input
                              value={messageDrafts[state.id] || ""}
                              onChange={(e) =>
                                setMessageDrafts((p) => ({ ...p, [state.id]: e.target.value }))
                              }
                              placeholder="Type a message"
                              className="h-9 flex-1 rounded-lg border border-white/15 bg-background px-3 text-xs text-white outline-none focus:border-accent"
                            />
                            <button
                              onClick={() => sendMessage(state.id)}
                              disabled={messaging[state.id]}
                              className="rounded-lg bg-accent px-3 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              Send
                            </button>
                          </div>
                          <button
                            onClick={() => loadMessages(state.id)}
                            className="text-xs text-accent hover:underline"
                          >
                            Refresh messages
                          </button>
                          <div className="max-h-40 overflow-y-auto space-y-1 text-xs text-white/80">
                            {(messageLists[state.id] || []).map((m) => (
                              <div key={m.id} className="rounded bg-white/5 px-2 py-1">
                                <span className="text-muted">{m.senderId === state.requesterId ? "Them" : "You"}: </span>
                                {m.text}
                              </div>
                            ))}
                            {messaging[state.id] && <p className="text-muted">Loading...</p>}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if (state?.status === "pending" && state.direction === "received") {
                    return (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(state, state.id)}
                          className="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white"
                        >
                          Accept Match
                        </button>
                        <button
                          onClick={() => handleDecline(state, state.id)}
                          className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-muted"
                        >
                          Decline
                        </button>
                      </div>
                    );
                  }
                  if (state?.status === "pending") {
                    return <p className="text-xs text-muted">Request sent · pending</p>;
                  }
                  return (
                    <button
                      onClick={() => handleRequest(match)}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
                    >
                      Request Match
                    </button>
                  );
                })()}
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
