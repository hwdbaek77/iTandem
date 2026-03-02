"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { api } from "../../lib/api";

const DEFAULT_LOTS = ["Taper", "Coldwater", "Hacienda", "St Michael", "Hamilton"];

const MVP_LOTS = [
  { name: "Taper Lot", slug: "taper" },
  { name: "Coldwater Lot", slug: "coldwater" },
  { name: "Hacienda Lot", slug: "hacienda" },
  { name: "St Michael Lot", slug: "st-michael" },
  { name: "Hamilton Lot", slug: "hamilton" },
];

export default function ParkingPage() {
  const [lots, setLots] = useState(null);

  useEffect(() => {
    api.getLots()
      .then((data) => {
        if (data.lots && data.lots.length > 0) {
          setLots(data.lots);
        } else {
          setLots(DEFAULT_LOTS.map((name) => ({ name, totalSpots: 0, availableSpots: 0 })));
        }
      })
      .catch(() => {
        setLots(DEFAULT_LOTS.map((name) => ({ name, totalSpots: 0, availableSpots: 0 })));
      });
  }, []);

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Find Parking</h2>
      <p className="mt-2 text-base text-muted">
        Select a lot to view available spots.
      </p>

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
