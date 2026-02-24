"use client";

import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import StatusCard from "../components/StatusCard";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

export default function HomePage() {
  const { profile } = useAuth();
  const [rentals, setRentals] = useState(null);
  const [schedule, setSchedule] = useState(null);

  useEffect(() => {
    api.getMyRentals().then((d) => setRentals(d.rentals)).catch(() => {});
    api.getMySchedule().then(setSchedule).catch(() => {});
  }, []);

  const name = profile?.name || "Student";
  const classYear = profile?.classYear || profile?.userType || "";

  const activeRental = rentals?.find((r) => r.status === "active");

  return (
    <AppShell>
      <section className="mb-8">
        <h2 className="text-4xl font-bold leading-tight">Welcome, {name}</h2>
        <p className="mt-1 text-lg text-muted">
          {classYear} &middot; Your Parking Dashboard
        </p>
      </section>

      <section className="space-y-4">
        <StatusCard
          icon="T"
          title="Tandem Partner"
          matched={null}
          promptText="You don't have a tandem partner yet"
          promptLabel="Find Match"
          promptHref="/parking"
          actionLabel="Message"
          actionHref="/chat"
        />

        <StatusCard
          icon="C"
          title="Carpool Partner"
          matched={null}
          promptText="You don't have a carpool partner yet"
          promptLabel="Find Match"
          promptHref="/carpool"
          actionLabel="Message"
          actionHref="/chat"
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
    </AppShell>
  );
}
