import AppShell from "../components/AppShell";

export default function HomePage() {
  return (
    <AppShell>
      <section className="mb-8">
        <h2 className="text-4xl font-bold leading-tight">Welcome to iTandem</h2>
        <p className="mt-2 text-lg text-muted">Your Parking Dashboard</p>
      </section>

      <section className="space-y-4">
        <div className="rounded-3xl bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-bold">
              C
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Find Carpool Partner</h3>
              <p className="mt-1 text-sm text-muted">
                Browse matches and connect with riders.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-xl font-bold">
              P
            </div>
            <div>
              <h3 className="text-2xl font-semibold">Find Parking Spot</h3>
              <p className="mt-1 text-sm text-muted">
                Check parking options and spot rankings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
