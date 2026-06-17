"use client";

import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// Auth state plus admin status from the admins/{uid} document
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authStage, setAuthStage] = useState<"loading" | "login" | "app">("loading");

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAuthStage("app");
        try {
          if (db) {
            const adminSnap = await getDoc(doc(db, "admins", currentUser.uid));
            setIsAdmin(adminSnap.exists());
          }
        } catch {
          setIsAdmin(false);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setAuthStage("login");
      }
    });
    return () => unsub();
  }, []);

  const logout = () => (auth ? signOut(auth) : Promise.resolve());

  return { user, isAdmin, authStage, logout };
}
