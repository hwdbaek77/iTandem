"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { api } from "../../lib/api";

const DEFAULT_LOTS = ["Taper", "Coldwater", "Hacienda", "St Michael", "Hamilton"];

export default function ParkingPage() {
  const [lots, setLots] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState(null);

  async function loadLots() {
    try {
      const data = await api.getLots();
      if (data.lots && data.lots.length > 0) {
        setLots(data.lots);
      } else {
        setLots(DEFAULT_LOTS.map((name) => ({ name, totalSpots: 0, availableSpots: 0 })));
      }
      setSeedError(null);
    } catch {
      setLots(DEFAULT_LOTS.map((name) => ({ name, totalSpots: 0, availableSpots: 0 })));
    }
  }

  useEffect(() => {
    loadLots();
  }, []);

  async function handleSeed() {
    setSeeding(true);
    setSeedError(null);
    try {
      await api.seedSpots();
      await loadLots();
    } catch (err) {
      setSeedError(err.message || "Failed to seed");
    } finally {
      setSeeding(false);
    }
  }

  const needsSeed = lots && lots.every((l) => l.totalSpots === 0);

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Find Parking</h2>
      <p className="mt-2 text-base text-muted">
        Select a lot to view available spots.
      </p>

      {needsSeed && (
        <div className="mt-4 rounded-3xl bg-card p-4 border border-amber-500/30">
          <p className="text-sm text-muted mb-2">Parking spots not yet initialized.</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {seeding ? "Initializing..." : "Initialize spots (admin only)"}
          </button>
          {seedError && <p className="mt-2 text-xs text-red-400">{seedError}</p>}
        </div>
      )}

      <section className="mt-6 space-y-3">
        {lots === null ? (
          <div className="py-8 text-center text-muted text-sm">Loading lots...</div>
        ) : (
          lots.map((lot) => (
            <Link
              key={lot.name}
              href={`/parking/spots/${encodeURIComponent(lot.name)}`}
              className="block rounded-3xl bg-card p-5 transition-colors hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{lot.name} Lot</h3>
                  <p className="mt-1 text-sm text-muted">
                    {lot.totalSpots > 0
                      ? `${lot.availableSpots} of ${lot.totalSpots} spots available`
                      : "Tap to view spots"}
                  </p>
                </div>
                <span className="text-accent" aria-hidden="true">
                  &gt;
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </AppShell>
  );
}
