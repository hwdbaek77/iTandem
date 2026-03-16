"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { api } from "../../lib/api";

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function StatusBadge({ status }) {
  const styles = {
    active: "bg-green-500/15 text-green-400 border-green-500/30",
    cancelled: "bg-white/5 text-muted border-white/10",
    completed: "bg-white/5 text-muted border-white/10",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.completed}`}>
      {status === "active" ? "Active" : status === "cancelled" ? "Cancelled" : "Completed"}
    </span>
  );
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    api.getMyRentals()
      .then((d) => setRentals(d.rentals || []))
      .catch(() => setRentals([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(rentalId) {
    setCancelling(rentalId);
    try {
      await api.cancelRental(rentalId);
      setRentals((prev) =>
        prev.map((r) => (r.id === rentalId ? { ...r, status: "cancelled" } : r))
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(null);
    }
  }

  const active = rentals?.filter((r) => r.status === "active") || [];
  const past = rentals?.filter((r) => r.status !== "active") || [];

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">My Rentals</h2>
      <p className="mt-2 text-base text-muted">
        View your active and past parking spot rentals.
      </p>

      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Loading rentals…
        </div>
      )}

      {/* Empty state */}
      {!loading && rentals?.length === 0 && (
        <div className="mt-6 rounded-3xl bg-card p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-2xl font-bold text-accent">
            P
          </div>
          <p className="text-sm text-muted mb-4">
            You haven&apos;t rented any parking spots yet.
          </p>
          <Link
            href="/parking"
            className="inline-block rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Browse Parking Lots
          </Link>
        </div>
      )}

      {/* Active Rentals */}
      {!loading && active.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Active</h3>
          <div className="space-y-3">
            {active.map((rental) => (
              <div key={rental.id} className="rounded-3xl bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {rental.lot} — Spot {rental.spotNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Rented {fmtDate(rental.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status="active" />
                    <button
                      onClick={() => handleCancel(rental.id)}
                      disabled={cancelling === rental.id}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancelling === rental.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Past Rentals */}
      {!loading && past.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Past</h3>
          <div className="space-y-3">
            {past.map((rental) => (
              <div key={rental.id} className="rounded-3xl bg-card p-5 opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">
                      {rental.lot} — Spot {rental.spotNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Rented {fmtDate(rental.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={rental.status} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
