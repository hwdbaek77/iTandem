"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function CarpoolPage() {
  const { profile } = useAuth();
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noSchedule, setNoSchedule] = useState(false);

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

  // Carpool scoring: weight schedule compatibility but focus on departure alignment
  const carpoolMatches = matches
    ?.filter((m) => m.compatible)
    .map((m) => ({
      ...m,
      carpoolScore: Math.round(m.score * 0.6 + (m.dayAverage || 0) * 0.4),
    }))
    .sort((a, b) => b.carpoolScore - a.carpoolScore);

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
              <div className="mt-3 flex gap-2">
                <Link
                  href="/chat"
                  className="flex-1 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
                >
                  Message
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}
    </AppShell>
  );
}
