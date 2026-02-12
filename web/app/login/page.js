export const metadata = {
  title: "Login | iTandem",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
      <div className="w-full rounded-3xl bg-card p-6 shadow-lg shadow-black/30">
        <h1 className="mb-1 text-3xl font-bold">
          <span className="text-accent">i</span>Tandem
        </h1>
        <p className="mb-6 text-sm text-muted">Sign in to continue</p>

        <form className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm">Email</span>
            <input
              type="email"
              placeholder="you@hw.com"
              className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm">Password</span>
            <input
              type="password"
              placeholder="********"
              className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
            />
          </label>

          <button
            type="button"
            className="mt-2 h-12 w-full rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
