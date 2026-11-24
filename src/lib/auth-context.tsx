// user auth
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { api } from "./api";
import { auth } from "./firebase";

export interface DevUser {
  uid?: string;
  name: string;
  email: string;
  role: "DEVELOPER";
  initials: string;
  
  isAdmin?: boolean;
}

const DEFAULT_DEV: DevUser = {
  uid: "",
  name: "Developer",
  email: "",
  role: "DEVELOPER",
  initials: "D",
};

interface AuthContextType {
  user: DevUser;
  isAuthenticated: boolean;
  loading: boolean;
  
  adminChecked: boolean;
  setUser: (user: DevUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_DEV,
  isAuthenticated: false,
  loading: false,
  adminChecked: false,
  setUser: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<DevUser>(DEFAULT_DEV);
  const [loading, setLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
      if (fbUser && fbUser.email && fbUser.emailVerified) {
        const name = fbUser.displayName || fbUser.email.split("@")[0] || "Developer";
        setUserState({
          uid: fbUser.uid,
          name,
          email: fbUser.email,
          role: "DEVELOPER",
          initials: name.slice(0, 1).toUpperCase(),
          isAdmin: false,
        });
        setAdminChecked(false);
        api
          .getSession()
          .then((s) => setUserState((prev) => ({ ...prev, isAdmin: s.isAdmin === true })))
          .catch(() => undefined) // not the owner as far as we can tell; the API enforces it anyway
          .finally(() => setAdminChecked(true));
      } else {
        setUserState(DEFAULT_DEV);
        setAdminChecked(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const setUser = (next: DevUser) => setUserState((prev) => ({ ...next, isAdmin: prev.isAdmin === true }));

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (e) {}
    setUserState(DEFAULT_DEV);
  };

  const isAuthenticated = !!(user && user.email && user.email.trim() !== "");

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, adminChecked, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

