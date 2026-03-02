"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { api } from "../../lib/api";

export default function TandemPage() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noSchedule, setNoSchedule] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [myMatchStates, setMyMatchStates] = useState({});
  const [messageDrafts, setMessageDrafts] = useState({});
  const [messageLists, setMessageLists] = useState({});
  const [messaging, setMessaging] = useState({});

  useEffect(() => {
    Promise.all([
      api.getRankedMatches().catch((err) => {
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

  const ranked = useMemo(() => matches || [], [matches]);

  function scoreColor(score) {
    if (score >= 70) return "text-green-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  }

  function scoreBg(score) {
    if (score >= 70) return "bg-green-400/10 border-green-400/30";
    if (score >= 40) return "bg-yellow-400/10 border-yellow-400/30";
    return "bg-red-400/10 border-red-400/30";
  }

  function matchKey(match) {
    return `${match.userId || match.name || "unknown"}:${match.type || "tandem"}`;
  }

  async function handleRequest(match) {
    const userId = match.userId;
    if (!userId) return alert("Missing user id for match");
    try {
      const res = await api.sendMatchRequest(userId, "tandem");
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ ...match, userId })]: {
          requesterId: "me",
          targetId: userId,
          status: res.status || "pending",
          type: "tandem",
          direction: "sent",
          id: res.matchId,
        },
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleAccept(matchState, matchId) {
    try {
      await api.acceptMatch(matchId);
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ userId: matchState.requesterId, type: matchState.type })]: {
          ...matchState,
          status: "active",
        },
      }));
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleDecline(matchState, matchId) {
    try {
      await api.declineMatch(matchId);
      setMyMatchStates((prev) => ({
        ...prev,
        [matchKey({ userId: matchState.requesterId, type: matchState.type })]: {
          ...matchState,
          status: "declined",
        },
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
      <h2 className="text-4xl font-bold">Tandem Matching</h2>
      <p className="mt-2 text-base text-muted">
        Find your best tandem parking partner based on schedule compatibility.
      </p>

      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Computing matches...
        </div>
      )}

      {!loading && noSchedule && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
            S
          </div>
          <p className="text-sm text-muted mb-4">
            Upload your schedule first to see compatibility matches.
          </p>
          <Link
            href="/profile"
            className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Upload Schedule
          </Link>
        </div>
      )}

      {!loading && !noSchedule && matches?.length === 0 && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <p className="text-sm text-muted">
            No other students have uploaded their schedules yet.
            Check back later!
          </p>
        </div>
      )}

      {!loading && ranked?.length > 0 && (
        <section className="mt-6 space-y-3">
          {ranked.map((match) => {
            const isExpanded = expanded === (match.userId || match.name);
            const state = myMatchStates[matchKey(match)];
            return (
              <div
                key={match.userId || match.name}
                className="rounded-3xl bg-card overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : (match.userId || match.name))}
                  className="w-full p-5 text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                        {match.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold">{match.name}</h3>
                        <p className="text-xs text-muted">
                          {match.compatible ? `Rank #${match.rank}` : "Incompatible"}
                        </p>
                      </div>
                    </div>
                    <div className={`rounded-xl border px-3 py-1.5 ${scoreBg(match.score)}`}>
                      <span className={`text-lg font-bold ${scoreColor(match.score)}`}>
                        {match.score}
                      </span>
                      <span className="text-xs text-muted">/100</span>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 pt-0 border-t border-white/5 space-y-3">
                    <div className="mt-3 space-y-2 text-sm">
                      {match.dayAverage !== undefined && (
                        <p><span className="text-muted">Day avg score:</span> {match.dayAverage}</p>
                      )}
                      {match.gradeScore !== undefined && (
                        <p><span className="text-muted">Grade match:</span> {match.gradeScore}/100</p>
                      )}
                      {!match.compatible && match.reason && (
                        <p className="text-xs text-red-400">{match.reason}</p>
                      )}
                    </div>

                    {/* Match actions */}
                    {match.compatible && (
                      <div className="space-y-2">
                        {state?.status === "active" ? (
                          <div className="space-y-2">
                            <p className="text-xs text-green-400">Matched! You can message now.</p>
                            <div className="rounded-2xl border border-white/10 p-3 space-y-2">
                              <div className="flex gap-2">
                                <input
                                  value={messageDrafts[state.id] || \"\"}
                                  onChange={(e) =>
                                    setMessageDrafts((p) => ({ ...p, [state.id]: e.target.value }))
                                  }
                                  placeholder=\"Type a message\"
                                  className=\"h-9 flex-1 rounded-lg border border-white/15 bg-background px-3 text-xs text-white outline-none focus:border-accent\"
                                />
                                <button
                                  onClick={() => sendMessage(state.id)}
                                  disabled={messaging[state.id]}
                                  className=\"rounded-lg bg-accent px-3 text-xs font-semibold text-white disabled:opacity-50\"
                                >
                                  Send
                                </button>
                              </div>
                              <button
                                onClick={() => loadMessages(state.id)}
                                className=\"text-xs text-accent hover:underline\"
                              >
                                Refresh messages
                              </button>
                              <div className=\"max-h-40 overflow-y-auto space-y-1 text-xs text-white/80\">
                                {(messageLists[state.id] || []).map((m) => (
                                  <div key={m.id} className=\"rounded bg-white/5 px-2 py-1\">
                                    <span className=\"text-muted\">{m.senderId === state.requesterId ? \"Them\" : \"You\"}: </span>
                                    {m.text}
                                  </div>
                                ))}
                                {messaging[state.id] && <p className=\"text-muted\">Loading...</p>}
                              </div>
                            </div>
                          </div>
                        ) : state?.status === \"pending\" && state.direction === \"received\" ? (
                          <div className=\"flex gap-2\">
                            <button
                              onClick={() => handleAccept(state, state.id)}
                              className=\"flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white\"
                            >
                              Accept Match
                            </button>
                            <button
                              onClick={() => handleDecline(state, state.id)}
                              className=\"flex-1 rounded-lg border border-white/15 px-3 py-2 text-xs text-muted\"
                            >
                              Decline
                            </button>
                          </div>
                        ) : state?.status === \"pending\" ? (
                          <p className=\"text-xs text-muted\">Request sent · pending</p>
                        ) : (
                          <button
                            onClick={() => handleRequest(match)}
                            className=\"mt-1 block w-full rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-hover\"
                          >
                            Request Match
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
