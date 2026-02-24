import AppShell from "../../../components/AppShell";
import Link from "next/link";
import { getSpotById } from "../../../lib/mockParking";

export default async function ParkingConfirmPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const spotId = resolvedSearchParams.spotId;
  const spot = spotId ? getSpotById(spotId) : null;

  return (
    <AppShell>
      <h2 className="text-3xl font-bold">Reservation Confirmed</h2>
      <p className="mt-2 text-sm text-muted">
        {spot
          ? `Spot ${spot.number} in ${spot.lot} Lot is reserved for you.`
          : "Your spot reservation was successful."}
      </p>

      <div className="mt-6 rounded-3xl bg-card p-5">
        <p className="text-sm text-muted">Status</p>
        <p className="mt-1 text-xl font-semibold text-green-400">Success</p>
      </div>

      <Link
        href="/"
        className="mt-6 block rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Return Home
      </Link>
    </AppShell>
  );
}
