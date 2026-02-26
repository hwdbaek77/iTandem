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
// slug = lowercase spot number with hyphen (e.g. "a-1")
const MOCK_SPOTS = [
  { number: "A-1", slug: "a-1", type: "Single", available: true },
  { number: "A-2", slug: "a-2", type: "Single", available: false },
  { number: "A-3", slug: "a-3", type: "Tandem", available: true },
  { number: "B-1", slug: "b-1", type: "Single", available: true },
  { number: "B-2", slug: "b-2", type: "Tandem", available: false },
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
          <li key={spot.number}>
            <Link
              href={`/parking/${lotSlug}/${spot.slug}`}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                spot.available
                  ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10"
                  : "border-white/10 bg-card/50 opacity-60 hover:opacity-80"
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
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
