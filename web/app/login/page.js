"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, { name, userType: "JUNIOR" });
      } else {
        await signIn(email, password);
      }
      router.push("/");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
      <div className="w-full rounded-3xl bg-card p-6 shadow-lg shadow-black/30">
        <h1 className="mb-1 text-3xl font-bold">
          <span className="text-accent">i</span>Tandem
        </h1>
        <p className="mb-6 text-sm text-muted">
          {isSignUp ? "Create your account" : "Sign in to continue"}
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <label className="block">
              <span className="mb-2 block text-sm">Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                required={isSignUp}
                className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
              />
            </label>
          )}

          <label className="block">
            <span className="mb-2 block text-sm">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@hw.com"
              required
              className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              minLength={6}
              className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-12 w-full rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            className="text-accent hover:underline"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
