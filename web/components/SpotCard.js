import Link from "next/link";

/**
 * Displays a single parking spot card with availability status.
 * Links to the spot detail page if available.
 */
export default function SpotCard({ lot, spot }) {
  const availabilityClass = spot.isAvailable ? "text-green-400" : "text-red-400";

  const content = (
    <div className="rounded-3xl bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Spot {spot.number}</h3>
          <p className="mt-1 text-sm text-muted">{lot} Lot</p>
        </div>
        <span className={`text-sm font-semibold ${availabilityClass}`}>
          {spot.isAvailable ? "Available" : "Unavailable"}
        </span>
      </div>
      {spot.type && (
        <p className="mt-3 text-sm text-muted">Type: {spot.type}</p>
      )}
      {spot.distanceMiles && (
        <p className="mt-1 text-sm text-muted">Distance: {spot.distanceMiles} mi</p>
      )}
    </div>
  );

  if (!spot.isAvailable) {
    return content;
  }

  return (
    <Link href={`/parking/spot/${spot.id}`} className="block transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}
