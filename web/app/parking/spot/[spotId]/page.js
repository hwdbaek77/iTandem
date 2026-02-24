"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "../../../../components/AppShell";
import Link from "next/link";
import { api } from "../../../../lib/api";

export default function SpotDetailPage() {
  const params = useParams();
  const [spot, setSpot] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSpot(params.spotId)
      .then((data) => setSpot(data))
      .catch(() => setSpot(null))
      .finally(() => setLoading(false));
  }, [params.spotId]);

  if (loading) {
    return (
      <AppShell>
        <div className="py-8 text-center text-muted text-sm">Loading spot details...</div>
      </AppShell>
    );
  }

  if (!spot) {
    return (
      <AppShell>
        <h2 className="text-3xl font-bold">Spot not found</h2>
        <p className="mt-2 text-sm text-muted">Please go back and select another spot.</p>
        <Link
          href="/parking"
          className="mt-6 inline-block rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
        >
          Back to Lots
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <h2 className="text-3xl font-bold">Spot {spot.number}</h2>
      <p className="mt-2 text-sm text-muted">{spot.lot} Lot</p>

      <div className="mt-6 space-y-3">
        {spot.distanceMiles && (
          <div className="rounded-3xl bg-card p-5">
            <p className="text-sm text-muted">Distance to campus</p>
            <p className="mt-1 text-xl font-semibold">{spot.distanceMiles} mi</p>
          </div>
        )}
        {spot.type && (
          <div className="rounded-3xl bg-card p-5">
            <p className="text-sm text-muted">Spot Type</p>
            <p className="mt-1 text-xl font-semibold">{spot.type}</p>
          </div>
        )}
        <div className="rounded-3xl bg-card p-5">
          <p className="text-sm text-muted">Availability</p>
          <p className={`mt-1 text-xl font-semibold ${spot.isAvailable ? "text-green-400" : "text-red-400"}`}>
            {spot.isAvailable ? "Available" : "Unavailable"}
          </p>
        </div>
      </div>

      {spot.isAvailable && (
        <Link
          href={`/parking/confirm?spotId=${encodeURIComponent(spot.id)}`}
          className="mt-6 block rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Rent This Spot
        </Link>
      )}

      <Link
        href={spot.lot ? `/parking/spots/${encodeURIComponent(spot.lot)}` : "/parking"}
        className="mt-4 inline-block rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Back to Spots
      </Link>
    </AppShell>
  );
}
