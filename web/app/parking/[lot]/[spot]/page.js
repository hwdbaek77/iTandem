import Link from "next/link";
import AppShell from "../../../../components/AppShell";

const LOT_NAMES = {
  taper: "Taper Lot",
  coldwater: "Coldwater Lot",
  hacienda: "Hacienda Lot",
  "st-michael": "St Michael Lot",
  hamilton: "Hamilton Lot",
};

// MVP: mock spot data (replace with API later)
const MOCK_SPOTS = {
  "a-1": { number: "A-1", type: "Single", available: true, price: 8 },
  "a-2": { number: "A-2", type: "Single", available: false, price: 8 },
  "a-3": { number: "A-3", type: "Tandem", available: true, price: 6 },
  "b-1": { number: "B-1", type: "Single", available: true, price: 7 },
  "b-2": { number: "B-2", type: "Tandem", available: false, price: 6 },
};

export default async function SpotRentalPage({ params }) {
  const { lot: lotSlug, spot: spotSlug } = await params;
  const lotName = LOT_NAMES[lotSlug];
  const spot = MOCK_SPOTS[spotSlug];

  if (!lotName || !spot) {
    return (
      <AppShell>
        <h2 className="text-4xl font-bold">Spot not found</h2>
        <Link href="/parking" className="mt-4 text-accent hover:underline">
          ← Back to parking
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        href={`/parking/${lotSlug}`}
        className="mb-4 inline-block text-sm text-muted hover:text-accent"
      >
        ← Back to {lotName}
      </Link>

      <div className="rounded-xl border border-white/10 bg-card/50 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Spot {spot.number}</h2>
            <p className="mt-1 text-muted">{lotName} · {spot.type}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              spot.available
                ? "bg-green-500/20 text-green-500"
                : "bg-muted/20 text-muted"
            }`}
          >
            {spot.available ? "Available" : "Rented"}
          </span>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Daily rate</span>
            <span className="text-2xl font-bold">${spot.price}</span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Full refund if cancelled 24+ hours before.
          </p>
        </div>

        {spot.available ? (
          <div className="mt-6 space-y-3">
            <label className="block text-sm font-medium text-muted">
              Select date
            </label>
            <input
              type="date"
              className="w-full rounded-lg border border-white/10 bg-background px-4 py-3 text-foreground"
              min={new Date().toISOString().split("T")[0]}
            />
            <button
              type="button"
              className="w-full rounded-full bg-accent py-3 font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Rent this spot
            </button>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted">
            This spot is currently rented. Check back later or browse other lots.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-white/10 bg-card/30 p-4">
        <h3 className="text-sm font-semibold">Rental policy</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted">
          <li>• Cancel 24+ hours before: full refund</li>
          <li>• Cancel day-of: $10 fine</li>
          <li>• Spot blocked by someone else: report for reassignment</li>
        </ul>
      </div>
    </AppShell>
  );
}
