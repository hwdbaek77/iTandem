"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "../../../../components/AppShell";
import Link from "next/link";
import SpotCard from "../../../../components/SpotCard";
import { api } from "../../../../lib/api";

export default function LotSpotsPage() {
  const params = useParams();
  const lot = decodeURIComponent(params.lot);
  const [spots, setSpots] = useState(null);

  useEffect(() => {
    if (lot) {
      api.getLotSpots(lot)
        .then((data) => setSpots(data.spots || []))
        .catch(() => setSpots([]));
    }
  }, [lot]);

  return (
    <AppShell>
      <h2 className="text-3xl font-bold">{lot} Lot</h2>
      <p className="mt-2 text-sm text-muted">Select an available spot to continue.</p>

      <div className="mt-6 space-y-3">
        {spots === null ? (
          <div className="py-8 text-center text-muted text-sm">Loading spots...</div>
        ) : spots.length === 0 ? (
          <div className="py-8 text-center text-muted text-sm">No spots found in this lot.</div>
        ) : (
          spots.map((spot) => (
            <SpotCard key={spot.id} lot={lot} spot={spot} />
          ))
        )}
      </div>

      <Link
        href="/parking"
        className="mt-6 inline-block rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Back to Lots
      </Link>
    </AppShell>
  );
}
