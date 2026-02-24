import AppShell from "../../../../components/AppShell";
import Link from "next/link";
import SpotCard from "../../../../components/SpotCard";
import { getSpotsForLot, lots } from "../../../../lib/mockParking";

export default async function LotSpotsPage({ params }) {
  const resolvedParams = await params;
  const decodedLot = decodeURIComponent(resolvedParams.lot);
  const lot = lots.includes(decodedLot) ? decodedLot : null;
  const spots = lot ? getSpotsForLot(lot) : [];

  return (
    <AppShell>
      <h2 className="text-3xl font-bold">{lot ? `${lot} Lot` : "Lot not found"}</h2>
      {lot ? (
        <p className="mt-2 text-sm text-muted">Select an available spot to continue.</p>
      ) : (
        <p className="mt-2 text-sm text-muted">Please return and choose a valid lot.</p>
      )}

      <div className="mt-6 space-y-3">
        {spots.map((spot) => (
          <SpotCard key={spot.id} lot={lot} spot={spot} />
        ))}
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
