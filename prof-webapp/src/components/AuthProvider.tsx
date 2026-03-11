"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuth, signInWithGoogle, signOut } from "@/lib/firebase";
import type { User } from "firebase/auth";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login() {
    await signInWithGoogle();
  }

  async function logout() {
    await signOut();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="inline-block w-8 h-8 border-3 border-cream-dark border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="carte-samr text-center max-w-md mx-auto">
          <div className="text-5xl mb-4">🔐</div>
          <h2
            className="text-2xl font-bold text-primary mb-2 tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Connexion requise
          </h2>
          <p className="text-sm mb-6" style={{ color: "#8a7f72" }}>
            Connectez-vous avec votre compte Google pour accéder à vos questionnaires.
          </p>
          <button
            onClick={login}
            className="bg-primary text-white px-6 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-primary-dark transition-colors cursor-pointer border-none"
          >
            Se connecter avec Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
