import Link from "next/link";

/**
 * Displays a single parking spot card with availability status.
 * Links to the confirmation page if the spot is available.
 */
export default function SpotCard({ lot, spot }) {
  const availabilityClass = spot.isAvailable ? "text-green-400" : "text-red-400";

  const typeLabel = {
    compact: "Compact",
    handicap: "Accessible",
    reserved: "Reserved",
    standard: null,
  };

  const badge = typeLabel[spot.type];

  const content = (
    <div className="rounded-2xl bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-bold">
            {spot.number}
          </div>
          <div>
            <p className="text-sm font-semibold">{lot} Lot</p>
            {badge && <span className="text-xs text-muted">{badge}</span>}
          </div>
        </div>
        <span className={`text-xs font-semibold ${availabilityClass}`}>
          {spot.isAvailable ? "Available" : "Taken"}
        </span>
      </div>
    </div>
  );

  if (!spot.isAvailable) {
    return <div className="opacity-50">{content}</div>;
  }

  return (
    <Link
      href={`/parking/confirm?spotId=${spot.id}`}
      className="block transition-opacity hover:opacity-90"
    >
      {content}
    </Link>
  );
}
