"use client";

import { AuthProvider } from "../context/AuthContext";

/**
 * Client-side providers wrapper.
 * Wraps children with all context providers needed by the app.
 */
export default function Providers({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
