import AppShell from "../components/AppShell";
import StatusCard from "../components/StatusCard";
import { mockUser } from "../lib/mockUser";

export default function HomePage() {
  const { name, classYear, tandemPartner, carpoolPartner, parkingSpot } =
    mockUser;

  return (
    <AppShell>
      {/* Welcome section */}
      <section className="mb-8">
        <h2 className="text-4xl font-bold leading-tight">
          Welcome, {name}
        </h2>
        <p className="mt-1 text-lg text-muted">
          Class of {classYear} &middot; Your Parking Dashboard
        </p>
      </section>

      {/* Status cards */}
      <section className="space-y-4">
        <StatusCard
          icon="T"
          title="Tandem Partner"
          matched={tandemPartner}
          matchedText={
            tandemPartner
              ? `${tandemPartner.name} · ${tandemPartner.spot}`
              : undefined
          }
          actionLabel="Message"
          actionHref="/chat"
          promptText="You don't have a tandem partner yet"
          promptLabel="Find Match"
          promptHref="/parking"
        />

        <StatusCard
          icon="C"
          title="Carpool Partner"
          matched={carpoolPartner}
          matchedText={
            carpoolPartner ? `${carpoolPartner.name}` : undefined
          }
          actionLabel="Message"
          actionHref="/chat"
          promptText="You don't have a carpool partner yet"
          promptLabel="Find Match"
          promptHref="/carpool"
        />

        <StatusCard
          icon="P"
          title="Parking Spot"
          matched={parkingSpot}
          matchedText={
            parkingSpot
              ? `Spot ${parkingSpot.number} · ${parkingSpot.lot} Lot · ${parkingSpot.type}`
              : undefined
          }
          actionLabel="View Spot"
          actionHref="/parking"
          promptText="You don't have a parking spot yet"
          promptLabel="Find Parking"
          promptHref="/parking"
        />
      </section>
    </AppShell>
  );
}
