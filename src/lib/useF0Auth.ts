"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebaseClient";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";

export function useF0Auth() {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });

    return () => unsub();
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function register(email: string, password: string) {
    setError(null);
    await createUserWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  return {
    user,
    initializing,
    error,
    setError,
    login,
    register,
    logout,
  };
}
