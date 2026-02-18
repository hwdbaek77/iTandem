import AppShell from "../../components/AppShell";
import Link from "next/link";
import { lots } from "../../lib/mockParking";

export default function ParkingPage() {
  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Find Parking</h2>
      <p className="mt-2 text-base text-muted">
        Select a lot to view available spots.
      </p>

      <section className="mt-6 space-y-3">
        {lots.map((lot) => (
          <Link
            key={lot}
            href={`/parking/spots/${encodeURIComponent(lot)}`}
            className="block rounded-3xl bg-card p-5 transition-colors hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{lot} Lot</h3>
                <p className="mt-1 text-sm text-muted">Tap to view spots</p>
              </div>
              <span className="text-accent" aria-hidden="true">
                &gt;
              </span>
            </div>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
