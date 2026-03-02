"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { api } from "../../lib/api";

export default function TandemPage() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noSchedule, setNoSchedule] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getRankedMatches()
      .then((data) => setMatches(data.matches || []))
      .catch((err) => {
        if (err.message?.includes("haven't uploaded") || err.message?.includes("schedule")) {
          setNoSchedule(true);
        }
        setMatches([]);
      })
      .finally(() => setLoading(false));
  }, []);

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

      {!loading && matches?.length > 0 && (
        <section className="mt-6 space-y-3">
          {matches.map((match) => {
            const isExpanded = expanded === (match.userId || match.name);
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
                  <div className="px-5 pb-5 pt-0 border-t border-white/5">
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
                    {match.compatible && (
                      <Link
                        href="/chat"
                        className="mt-3 block rounded-xl bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
                      >
                        Message {match.name?.split(" ")[0]}
                      </Link>
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
