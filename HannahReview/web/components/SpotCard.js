import Link from "next/link";

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

      <p className="mt-4 text-sm text-muted">Distance: {spot.distanceMiles} mi</p>
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
