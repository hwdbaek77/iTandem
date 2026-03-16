"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import StatusCard from "../components/StatusCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Link from "next/link";

export default function HomePage() {
  const { profile } = useAuth();
  const [rentals, setRentals] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [topMatch, setTopMatch] = useState(null);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    api.getMyRentals().then((d) => setRentals(d.rentals || [])).catch(() => setRentals([]));
    api.getMySchedule().then(setSchedule).catch(() => {});
    api.getRankedMatches()
      .then((d) => {
        const best = d.matches?.find((m) => m.compatible);
        if (best) setTopMatch(best);
      })
      .catch(() => {});
  }, []);

  const name = profile?.name || "Student";
  const gradeLabel = { SOPHOMORE: "Sophomore", JUNIOR: "Junior", SENIOR: "Senior" };
  const classYear = gradeLabel[profile?.userType] || profile?.userType || "";

  const activeRentals = rentals?.filter((r) => r.status === "active") || [];
  const activeRental = activeRentals[0];

  async function handleCancel(rentalId) {
    setCancelling(rentalId);
    try {
      await api.cancelRental(rentalId);
      setRentals((prev) => prev.map((r) => r.id === rentalId ? { ...r, status: "cancelled" } : r));
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <AppShell>
      <section className="mb-8">
        <h2 className="text-4xl font-bold leading-tight">Welcome, {name}</h2>
        <p className="mt-1 text-lg text-muted">
          {classYear} &middot; Your Dashboard
        </p>
      </section>

      <section className="space-y-4">
        <StatusCard
          icon="T"
          title="Tandem Partner"
          matched={topMatch}
          matchedText={
            topMatch
              ? `${topMatch.name} · Score ${topMatch.score}/100`
              : undefined
          }
          promptText="Find a tandem partner by schedule"
          promptLabel="Find Match"
          promptHref="/tandem"
          actionLabel="View Matches"
          actionHref="/tandem"
        />

        <StatusCard
          icon="C"
          title="Carpool"
          matched={topMatch}
          matchedText={
            topMatch
              ? `${topMatch.name} · Best carpool match`
              : undefined
          }
          promptText="Find students to carpool with"
          promptLabel="Find Carpool"
          promptHref="/carpool"
          actionLabel="View Matches"
          actionHref="/carpool"
        />

        <StatusCard
          icon="P"
          title="Parking Spot"
          matched={activeRental}
          matchedText={
            activeRental
              ? `Spot ${activeRental.spotNumber} · ${activeRental.lot} Lot`
              : undefined
          }
          actionLabel="View Spot"
          actionHref="/parking"
          promptText="You don't have a parking spot yet"
          promptLabel="Find Parking"
          promptHref="/parking"
        />

        <StatusCard
          icon="S"
          title="Schedule"
          matched={schedule}
          matchedText={
            schedule
              ? `${schedule.courses?.length || 0} courses parsed · Grade ${schedule.grade}`
              : undefined
          }
          actionLabel="View"
          actionHref="/profile"
          promptText="Upload your schedule to find matches"
          promptLabel="Upload"
          promptHref="/profile"
        />
      </section>

      {/* Active Rentals */}
      {activeRentals.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-bold">Active Rentals</h3>
            <Link href="/rentals" className="text-sm text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {activeRentals.map((rental) => (
              <div key={rental.id} className="rounded-3xl bg-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Spot {rental.spotNumber}</p>
                    <p className="text-sm text-muted">{rental.lot} Lot</p>
                  </div>
                  <button
                    onClick={() => handleCancel(rental.id)}
                    disabled={cancelling === rental.id}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {cancelling === rental.id ? "Cancelling..." : "Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section className="mt-8 mb-4">
        <h3 className="text-xl font-bold mb-3">Quick Links</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/tandem" className="rounded-2xl bg-card p-4 text-center transition-colors hover:bg-white/10">
            <span className="text-2xl block mb-1">T</span>
            <span className="text-sm text-muted">Find Tandem</span>
          </Link>
          <Link href="/carpool" className="rounded-2xl bg-card p-4 text-center transition-colors hover:bg-white/10">
            <span className="text-2xl block mb-1">C</span>
            <span className="text-sm text-muted">Find Carpool</span>
          </Link>
          <Link href="/parking" className="rounded-2xl bg-card p-4 text-center transition-colors hover:bg-white/10">
            <span className="text-2xl block mb-1">P</span>
            <span className="text-sm text-muted">Browse Lots</span>
          </Link>
          <Link href="/profile" className="rounded-2xl bg-card p-4 text-center transition-colors hover:bg-white/10">
            <span className="text-2xl block mb-1">S</span>
            <span className="text-sm text-muted">My Schedule</span>
          </Link>
        </div>
      </section>
    </AppShell>
  );
}
