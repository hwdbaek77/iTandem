"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "../../../components/AppShell";
import Link from "next/link";
import { api } from "../../../lib/api";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const spotId = searchParams.get("spotId");
  const [status, setStatus] = useState("loading");
  const [rental, setRental] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!spotId) {
      setStatus("error");
      setError("No spot selected");
      return;
    }

    api.createRental({ spotId })
      .then((data) => {
        setRental(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message || "Failed to create reservation");
        setStatus("error");
      });
  }, [spotId]);

  if (status === "loading") {
    return <div className="py-8 text-center text-muted text-sm">Creating reservation...</div>;
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
      <h2 className="text-3xl font-bold">Reservation Confirmed</h2>
      <p className="mt-2 text-sm text-muted">
        {rental?.rental
          ? `Spot ${rental.rental.spotNumber} in ${rental.rental.lot} Lot is reserved for you.`
          : "Your spot reservation was successful."}
      </p>

      <div className="mt-6 rounded-3xl bg-card p-5">
        <p className="text-sm text-muted">Status</p>
        <p className="mt-1 text-xl font-semibold text-green-400">Success</p>
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
