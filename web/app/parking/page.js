import Link from "next/link";
import AppShell from "../../components/AppShell";

const MVP_LOTS = [
  { name: "Taper Lot", slug: "taper" },
  { name: "Coldwater Lot", slug: "coldwater" },
  { name: "Hacienda Lot", slug: "hacienda" },
  { name: "St Michael Lot", slug: "st-michael" },
  { name: "Hamilton Lot", slug: "hamilton" },
];

export default function ParkingPage() {
  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Find Parking</h2>
      <p className="mt-3 text-base text-muted">
        Browse available spots by lot.
      </p>

      {/* Map placeholder for MVP */}
      <section className="mt-6 rounded-xl border border-white/10 bg-card/50 p-8 text-center">
        <p className="text-lg font-medium text-muted">Map</p>
        <p className="mt-2 text-2xl font-semibold text-muted/80">Coming soon</p>
      </section>

      {/* List of spots by lot */}
      <section className="mt-6">
        <h3 className="text-lg font-semibold">Available Lots</h3>
        <ul className="mt-3 space-y-2">
          {MVP_LOTS.map(({ name, slug }) => (
            <li key={slug}>
              <Link
                href={`/parking/${slug}`}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-card/50 px-4 py-3 transition-colors hover:border-white/20 hover:bg-card/80"
              >
                <span className="font-medium">{name}</span>
                <span className="text-sm text-muted">View spots →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
