"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { profile } = useAuth();
  const initial = profile?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 w-full max-w-md items-center justify-between border-b border-white/10 bg-background/95 px-4 backdrop-blur">
        <Link href="/" className="text-xl font-bold tracking-wide">
          <span className="text-accent">i</span>Tandem
        </Link>
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-sm font-semibold text-white transition-colors hover:bg-white/15"
        >
          {initial}
        </Link>
      </div>
    </header>
  );
}
