"use client";

import { useEffect, useState } from "react";
import AppShell from "../../components/AppShell";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
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
  const { profile } = useAuth();
  const [rentals, setRentals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    api.getMyRentals()
      .then((d) => setRentals(d.rentals || []))
      .catch(() => setRentals([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(e, rentalId) {
    e.preventDefault();
    e.stopPropagation();
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

  const hasSpot = profile?.hasSpot;
  const spotLot = profile?.spotLot;
  const spotNumber = profile?.parkingSpot;
  const isListed = profile?.isListedForRent;
  const rentDays = profile?.rentDays || [];

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">Rentals</h2>
      <p className="mt-2 text-base text-muted">
        Your parking spots and rental history.
      </p>

      {/* ── Your Spots ── */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Your Spots</h3>
          <Link href="/parking" className="text-sm text-accent hover:underline">
            Browse lots
          </Link>
        </div>

        {hasSpot && spotLot && spotNumber ? (
          <div className="rounded-3xl bg-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{spotLot} — Spot {spotNumber}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {isListed
                    ? `Listed for rent: ${rentDays.join(", ") || "no days set"}`
                    : "Not listed for rent"}
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isListed
                  ? "bg-accent/15 text-accent border-accent/30"
                  : "bg-white/5 text-muted border-white/10"
              }`}>
                {isListed ? "On Market" : "Private"}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href="/profile"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-muted transition-colors hover:bg-white/5"
              >
                Edit spot settings
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-card p-5 text-center">
            <p className="text-sm text-muted">
              {hasSpot
                ? "Set your lot and spot number in your profile."
                : "You don\u2019t have an assigned parking spot."}
            </p>
            <Link
              href="/profile"
              className="mt-3 inline-block text-sm text-accent hover:underline"
            >
              {hasSpot ? "Complete spot setup" : "Update profile"}
            </Link>
          </div>
        )}
      </section>

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-8 py-8 text-center text-muted text-sm">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
          Loading rentals…
        </div>
      )}

      {/* ── Empty state ── */}
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

      {/* ── Active Rentals ── */}
      {!loading && active.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Active</h3>
          <div className="space-y-3">
            {active.map((rental) => (
              <Link
                key={rental.id}
                href={`/rentals/${rental.id}`}
                className="block rounded-3xl bg-card p-5 transition-colors hover:bg-white/5"
              >
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
                      onClick={(e) => handleCancel(e, rental.id)}
                      disabled={cancelling === rental.id}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {cancelling === rental.id ? "Cancelling…" : "Cancel"}
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Past Rentals ── */}
      {!loading && past.length > 0 && (
        <section className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Past</h3>
          <div className="space-y-3">
            {past.map((rental) => (
              <Link
                key={rental.id}
                href={`/rentals/${rental.id}`}
                className="block rounded-3xl bg-card p-5 opacity-70 transition-colors hover:opacity-90"
              >
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
              </Link>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
