"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const data = await api.getMe();
          setProfile(data);
        } catch {
          setProfile(null);
        }
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
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await api.signup({ email, ...extra });
    return cred.user;
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setProfile(null);
  }

  async function refreshProfile() {
    try {
      const data = await api.getMe();
      setProfile(data);
    } catch {
      setProfile(null);
    }
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
