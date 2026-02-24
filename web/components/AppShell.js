"use client";

import AuthGuard from "./AuthGuard";
import Header from "./Header";
import BottomNav from "./BottomNav";

/**
 * Main app shell wrapping all authenticated pages.
 * Includes the header, bottom nav, and auth guard redirect.
 */
export default function AppShell({ children }) {
  return (
    <AuthGuard>
      <div className="mx-auto min-h-screen w-full max-w-md bg-background">
        <Header />
        <main className="px-4 pb-24 pt-20">{children}</main>
        <BottomNav />
      </div>
    </AuthGuard>
  );
}
