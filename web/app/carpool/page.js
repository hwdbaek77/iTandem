"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import { api } from "../../lib/api";

export default function CarpoolPage() {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noSchedule, setNoSchedule] = useState(false);

  useEffect(() => {
    api.getRankedMatches()
      .then((data) => {
        setMatches(data.matches || []);
      })
      .catch((err) => {
        if (err.message.includes("haven't uploaded")) {
          setNoSchedule(true);
        }
        setMatches([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Tandem Matching</h2>
      <p className="mt-2 text-base text-muted">
        Find your best tandem parking partner based on schedule compatibility.
      </p>

      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          Computing matches...
        </div>
      )}

      {!loading && noSchedule && (
        <div className="mt-6 rounded-3xl bg-card p-5 text-center">
          <p className="text-sm text-muted mb-3">
            Upload your schedule first to see compatibility matches.
          </p>
          <a
            href="/profile"
            className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Upload Schedule
          </a>
        </div>
      )}

      {!loading && !noSchedule && matches?.length === 0 && (
        <div className="mt-6 rounded-3xl bg-card p-5 text-center">
          <p className="text-sm text-muted">
            No other students have uploaded their schedules yet.
            Check back later!
          </p>
        </div>
      )}

      {!loading && matches?.length > 0 && (
        <section className="mt-6 space-y-3">
          {matches.map((match) => (
            <div key={match.userId || match.name} className="rounded-3xl bg-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{match.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {match.compatible ? `Rank #${match.rank}` : "Incompatible"}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${
                    match.score >= 70 ? "text-green-400" :
                    match.score >= 40 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {match.score}
                  </span>
                  <p className="text-xs text-muted">/100</p>
                </div>
              </div>
              {!match.compatible && match.reason && (
                <p className="mt-2 text-xs text-red-400">{match.reason}</p>
              )}
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
