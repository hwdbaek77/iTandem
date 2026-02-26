"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import Link from "next/link";
import { api } from "../../../lib/api";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const spotId = searchParams.get("spotId");
  const [status, setStatus] = useState("preview");
  const [spot, setSpot] = useState(null);
  const [rental, setRental] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!spotId) {
      setStatus("error");
      setError("No spot selected");
      return;
    }
    api.getSpot(spotId)
      .then((data) => setSpot(data))
      .catch(() => {
        setStatus("error");
        setError("Could not load spot details");
      });
  }, [spotId]);

  async function handleConfirm() {
    setStatus("loading");
    try {
      const data = await api.createRental({ spotId });
      setRental(data);
      setStatus("success");
    } catch (err) {
      setError(err.message || "Failed to create reservation");
      setStatus("error");
    }
  }

  if (status === "preview") {
    return (
      <>
        <h2 className="text-3xl font-bold">Confirm Reservation</h2>
        <p className="mt-2 text-sm text-muted">Review the spot details and confirm.</p>

        {spot ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-3xl bg-card p-5">
              <p className="text-sm text-muted">Spot</p>
              <p className="mt-1 text-xl font-semibold">Spot {spot.number}</p>
            </div>
            <div className="rounded-3xl bg-card p-5">
              <p className="text-sm text-muted">Lot</p>
              <p className="mt-1 text-xl font-semibold">{spot.lot} Lot</p>
            </div>
            {spot.type && (
              <div className="rounded-3xl bg-card p-5">
                <p className="text-sm text-muted">Type</p>
                <p className="mt-1 text-xl font-semibold">{spot.type}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 py-4 text-center text-sm text-muted">Loading spot details...</div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!spot}
          className="mt-6 block w-full rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Confirm Reservation
        </button>
        <Link
          href="/parking"
          className="mt-3 block text-center text-sm text-muted hover:text-white"
        >
          Cancel
        </Link>
      </>
    );
  }

  if (status === "loading") {
    return (
      <div className="py-8 text-center">
        <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent mx-auto" />
        <p className="text-muted text-sm">Creating reservation...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <>
        <h2 className="text-3xl font-bold">Reservation Failed</h2>
        <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
        <Link
          href="/parking"
          className="mt-6 block rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Back to Parking
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
      <h2 className="mt-4 text-3xl font-bold text-center">Reservation Confirmed</h2>
      <p className="mt-2 text-sm text-muted text-center">
        {rental?.rental
          ? `Spot ${rental.rental.spotNumber} in ${rental.rental.lot} Lot is reserved for you.`
          : "Your spot reservation was successful."}
      </p>

      <div className="mt-6 rounded-3xl bg-card p-5">
        <p className="text-sm text-muted">Status</p>
        <p className="mt-1 text-xl font-semibold text-green-400">Active</p>
      </div>

      <Link
        href="/"
        className="mt-6 block rounded-xl bg-accent px-5 py-3 text-center text-base font-semibold text-white transition-colors hover:bg-accent-hover"
      >
        Return Home
      </Link>
    </>
  );
}

export default function ParkingConfirmPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="py-8 text-center text-muted text-sm">Loading...</div>}>
        <ConfirmContent />
      </Suspense>
    </AppShell>
  );
}
