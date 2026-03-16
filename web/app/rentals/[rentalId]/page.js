"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "../../../components/AppShell";
import Link from "next/link";
import { api } from "../../../lib/api";

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
    completed: "bg-white/5 text-muted border-white/10",
  };
  const labels = { active: "Active", cancelled: "Cancelled", completed: "Completed" };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${styles[status] || styles.completed}`}>
      {labels[status] || status}
    </span>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );
}

export default function RentalDetailPage() {
  const { rentalId } = useParams();
  const router = useRouter();
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api.getRental(rentalId)
      .then((d) => setRental(d))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [rentalId]);

  async function handleCancel() {
    if (!confirm("Cancel this rental? This cannot be undone.")) return;
    setCancelling(true);
    try {
      await api.cancelRental(rentalId);
      setRental((prev) => ({ ...prev, status: "cancelled" }));
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <AppShell>
      {/* Back link */}
      <Link href="/rentals" className="inline-flex items-center gap-1 text-sm text-accent hover:underline mb-4">
        &larr; Back to rentals
      </Link>

      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Loading rental details…
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button onClick={() => router.push("/rentals")} className="mt-3 text-sm text-accent hover:underline">
            Go back
          </button>
        </div>
      )}

      {!loading && rental && (
        <>
          {/* Header */}
          <div className="rounded-3xl bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold">
                  {rental.lot} — Spot {rental.spotNumber}
                </h2>
                <p className="mt-1 text-sm text-muted">Rental Confirmation</p>
              </div>
              <StatusBadge status={rental.status} />
            </div>

            {/* Details */}
            <div className="mt-2">
              <Row label="Rental ID" value={rentalId} />
              <Row label="Lot" value={rental.lot} />
              <Row label="Spot Number" value={rental.spotNumber} />
              <Row label="Spot Type" value={rental.type || "Standard"} />
              <Row label="Status" value={rental.status} />
              <Row label="Created" value={fmtDateTime(rental.createdAt)} />
              {rental.startDate && (
                <Row label="Start Date" value={fmtDate(rental.startDate)} />
              )}
              {rental.endDate && (
                <Row label="End Date" value={fmtDate(rental.endDate)} />
              )}
              {rental.cancelledAt && (
                <Row label="Cancelled" value={fmtDateTime(rental.cancelledAt)} />
              )}
              {rental.ownerId && (
                <Row label="Spot Owner" value={rental.ownerId.substring(0, 12) + "…"} />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-4 space-y-3">
            {rental.status === "active" && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel Rental"}
              </button>
            )}

            <Link
              href="/parking"
              className="block w-full rounded-xl border border-white/15 px-5 py-3 text-center text-sm font-semibold text-muted transition-colors hover:bg-white/5"
            >
              Browse Parking Lots
            </Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
