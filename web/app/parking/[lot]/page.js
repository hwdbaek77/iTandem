import Link from "next/link";
import AppShell from "../../../components/AppShell";

// Slug → display name
const LOT_NAMES = {
  taper: "Taper Lot",
  coldwater: "Coldwater Lot",
  hacienda: "Hacienda Lot",
  "st-michael": "St Michael Lot",
  hamilton: "Hamilton Lot",
};

// MVP: placeholder spots per lot (replace with API data later)
const MOCK_SPOTS = [
  { number: "A-1", type: "Single", available: true },
  { number: "A-2", type: "Single", available: false },
  { number: "A-3", type: "Tandem", available: true },
  { number: "B-1", type: "Single", available: true },
  { number: "B-2", type: "Tandem", available: false },
];

export default async function LotPage({ params }) {
  const { lot: lotSlug } = await params;
  const lotName = LOT_NAMES[lotSlug];

  if (!lotName) {
    return (
      <AppShell>
        <h2 className="text-4xl font-bold">Lot not found</h2>
        <Link href="/parking" className="mt-4 text-accent hover:underline">
          ← Back to parking
        </Link>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link
        href="/parking"
        className="mb-4 inline-block text-sm text-muted hover:text-accent"
      >
        ← Back to lots
      </Link>
      <h2 className="text-4xl font-bold">{lotName}</h2>
      <p className="mt-3 text-base text-muted">
        Available spots for rent.
      </p>

      <ul className="mt-6 space-y-2">
        {MOCK_SPOTS.map((spot) => (
          <li
            key={spot.number}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              spot.available
                ? "border-green-500/30 bg-green-500/5"
                : "border-white/10 bg-card/50 opacity-60"
            }`}
          >
            <div>
              <span className="font-medium">Spot {spot.number}</span>
              <span className="ml-2 text-sm text-muted">({spot.type})</span>
            </div>
            <span
              className={`text-sm font-medium ${
                spot.available ? "text-green-500" : "text-muted"
              }`}
            >
              {spot.available ? "Available" : "Rented"}
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
