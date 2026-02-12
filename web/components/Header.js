export default function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between border-b border-white/10 bg-background/95 px-4 backdrop-blur">
        <h1 className="text-xl font-bold tracking-wide">
          <span className="text-accent">i</span>Tandem
        </h1>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-sm font-semibold text-white">
          H
        </div>
      </div>
    </header>
  );
}
