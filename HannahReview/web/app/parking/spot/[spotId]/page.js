import AppShell from "../../../../components/AppShell";
import Link from "next/link";
import { getSpotById } from "../../../../lib/mockParking";

export default async function SpotDetailPage({ params }) {
  const resolvedParams = await params;
  const spot = getSpotById(resolvedParams.spotId);

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

      <div className="mt-6 rounded-3xl bg-card p-5">
        <p className="text-sm text-muted">Distance to campus</p>
        <p className="mt-1 text-xl font-semibold">{spot.distanceMiles} mi</p>
      </div>

      <Link
        href={`/parking/confirm?spotId=${encodeURIComponent(spot.id)}`}
        className="mt-6 block rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Rent This Spot
      </Link>

      <Link
        href={`/parking/spots/${encodeURIComponent(spot.lot)}`}
        className="mt-4 inline-block rounded-full border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
      >
        Back to Spots
      </Link>
    </AppShell>
  );
}
