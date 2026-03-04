"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";

const GRADE_OPTIONS = [
  { value: "SOPHOMORE", label: "Sophomore" },
  { value: "JUNIOR", label: "Junior" },
  { value: "SENIOR", label: "Senior" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("JUNIOR");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn, signUp } = useAuth();

  const [step, setStep] = useState(1);
  const [licensePlate, setLicensePlate] = useState("");
  const [parkingSpot, setParkingSpot] = useState("");
  const [hasSpot, setHasSpot] = useState(false);
  const [isListedForRent, setIsListedForRent] = useState(false);
  const [rentDays, setRentDays] = useState([]);
  const [doesTandem, setDoesTandem] = useState(false);
  const [doesCarpool, setDoesCarpool] = useState(false);

  const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  function toggleDay(day) {
    setRentDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isSignUp) {
      setLoading(true);
      try {
        await signIn(email, password);
        router.push("/");
      } catch (err) {
        setError(err.message || "Authentication failed");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 1) {
      if (!name.trim()) {
        setError("Please enter your full name");
        return;
      }
      if (!email.trim()) {
        setError("Please enter your email");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      setStep(2);
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, {
        name,
        userType: grade,
        licensePlate: licensePlate.trim() || null,
        parkingSpot: hasSpot ? parkingSpot.trim() || null : null,
        hasSpot,
        isListedForRent: hasSpot && isListedForRent,
        rentDays: hasSpot && isListedForRent ? rentDays : [],
        doesTandem,
        doesCarpool,
      });
      router.push("/profile?setup=1");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setError("");
    setStep(1);
  }

  const stepIndicator = isSignUp && (
    <div className="mb-6 flex items-center justify-center gap-2">
      <div className={`h-2 w-2 rounded-full transition-colors ${step === 1 ? "bg-accent" : "bg-white/20"}`} />
      <div className={`h-8 w-px ${step >= 2 ? "bg-accent" : "bg-white/10"}`} />
      <div className={`h-2 w-2 rounded-full transition-colors ${step === 2 ? "bg-accent" : "bg-white/20"}`} />
    </div>
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
      <div className="w-full rounded-3xl bg-card p-6 shadow-lg shadow-black/30">
        <h1 className="mb-1 text-3xl font-bold">
          <span className="text-accent">i</span>Tandem
        </h1>
        <p className="mb-4 text-sm text-muted">
          {!isSignUp
            ? "Sign in to continue"
            : step === 1
              ? "Create your account"
              : "Tell us about your parking"}
        </p>

        {stepIndicator}

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STEP 1: Account basics */}
          {(!isSignUp || step === 1) && (
            <>
              {isSignUp && (
                <label className="block">
                  <span className="mb-2 block text-sm">Full Name</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    required
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
            </>
          )}

          {/* STEP 2: Parking survey */}
          {isSignUp && step === 2 && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm">Grade Level</span>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none focus:border-accent"
                >
                  {GRADE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm">License Plate</span>
                <input
                  type="text"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  placeholder="ABC 1234"
                  className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
                />
              </label>

              <div>
                <span className="mb-2 block text-sm">Do you have an assigned parking spot?</span>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setHasSpot(true)}
                    className={`flex-1 h-12 rounded-xl border font-medium transition-colors ${
                      hasSpot
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/15 bg-background text-muted hover:border-white/30"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => { setHasSpot(false); setParkingSpot(""); setIsListedForRent(false); setRentDays([]); }}
                    className={`flex-1 h-12 rounded-xl border font-medium transition-colors ${
                      !hasSpot
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/15 bg-background text-muted hover:border-white/30"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {hasSpot && (
                <>
                  <label className="block">
                    <span className="mb-2 block text-sm">Spot Number / Location</span>
                    <input
                      type="text"
                      value={parkingSpot}
                      onChange={(e) => setParkingSpot(e.target.value)}
                      placeholder="e.g. A-12, Taper S45"
                      className="h-12 w-full rounded-xl border border-white/15 bg-background px-3 text-white outline-none placeholder:text-muted focus:border-accent"
                    />
                  </label>

                  <div>
                    <span className="mb-2 block text-sm">List your spot for rent when you&apos;re not using it?</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsListedForRent(true)}
                        className={`flex-1 h-12 rounded-xl border font-medium transition-colors ${
                          isListedForRent
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/15 bg-background text-muted hover:border-white/30"
                        }`}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsListedForRent(false); setRentDays([]); }}
                        className={`flex-1 h-12 rounded-xl border font-medium transition-colors ${
                          !isListedForRent
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/15 bg-background text-muted hover:border-white/30"
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {isListedForRent && (
                    <div>
                      <span className="mb-2 block text-sm">Which days can others rent your spot?</span>
                      <div className="flex flex-wrap gap-2">
                        {WEEK_DAYS.map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={`h-10 w-12 rounded-xl border font-medium text-sm transition-colors ${
                              rentDays.includes(day)
                                ? "border-accent bg-accent/15 text-accent"
                                : "border-white/15 bg-background text-muted hover:border-white/30"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setRentDays(rentDays.length === 5 ? [] : [...WEEK_DAYS])}
                          className="h-10 rounded-xl border border-white/15 px-3 text-sm text-muted hover:border-white/30"
                        >
                          {rentDays.length === 5 ? "Clear" : "All"}
                        </button>
                      </div>
                      {rentDays.length === 0 && (
                        <p className="mt-1 text-xs text-amber-400">Select at least one day.</p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <span className="mb-3 block text-sm">What are you interested in?</span>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setDoesTandem(!doesTandem)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      doesTandem
                        ? "border-accent bg-accent/15"
                        : "border-white/15 bg-background hover:border-white/30"
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      doesTandem ? "border-accent bg-accent" : "border-white/30"
                    }`}>
                      {doesTandem && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${doesTandem ? "text-accent" : "text-white"}`}>Tandem Parking</p>
                      <p className="text-xs text-muted">Share a parking spot with another student</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDoesCarpool(!doesCarpool)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      doesCarpool
                        ? "border-accent bg-accent/15"
                        : "border-white/15 bg-background hover:border-white/30"
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      doesCarpool ? "border-accent bg-accent" : "border-white/30"
                    }`}>
                      {doesCarpool && (
                        <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${doesCarpool ? "text-accent" : "text-white"}`}>Carpooling</p>
                      <p className="text-xs text-muted">Share rides with other students</p>
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          <div className={`flex gap-3 ${isSignUp && step === 2 ? "pt-2" : ""}`}>
            {isSignUp && step === 2 && (
              <button
                type="button"
                onClick={handleBack}
                className="h-12 flex-1 rounded-xl border border-white/15 font-semibold text-muted transition-colors hover:bg-white/5"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={loading || (isSignUp && step === 2 && isListedForRent && rentDays.length === 0)}
              className="mt-2 h-12 flex-1 rounded-xl bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : !isSignUp
                  ? "Sign In"
                  : step === 1
                    ? "Next"
                    : "Create Account"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setStep(1);
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
