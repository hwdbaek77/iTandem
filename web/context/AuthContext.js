"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { api } from "../lib/api";

const AuthContext = createContext(null);

/**
 * Provides Firebase Auth state and helper methods to the component tree.
 * Wraps the app in layout.js so every page can access auth via useAuth().
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile() {
    try {
      const data = await api.getMe();
      setProfile(data.user || data);
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function signUp(email, password, extra = {}) {
    try {
      await api.signup({ email, password, ...extra });
    } catch (apiErr) {
      // If the backend created the Firebase Auth user but failed afterwards
      // (e.g. custom token generation), the account exists and we can sign in.
      // Only re-throw for definitive failures like missing fields (400).
      try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        return cred.user;
      } catch {
        throw apiErr;
      }
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setProfile(null);
  }

  async function refreshProfile() {
    await fetchProfile();
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
