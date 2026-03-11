"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const liens = [
    { href: "/", label: "Accueil" },
    { href: "/create", label: "Créer" },
    { href: "/analyse", label: "Analyse" },
  ];

  return (
    <header className="bg-primary sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <span className="text-white text-xl">🔍</span>
          <span
            className="text-white text-lg tracking-widest uppercase"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            NavigKid!
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <nav className="flex gap-1">
            {liens.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-widest transition-colors no-underline ${
                  pathname === l.href
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {user && (
            <div className="flex items-center gap-3 ml-2 border-l border-white/20 pl-4">
              <span className="text-white/80 text-xs truncate max-w-[150px]">
                {user.displayName || user.email}
              </span>
              <button
                onClick={logout}
                className="text-white/60 hover:text-white text-xs uppercase tracking-wider cursor-pointer border-none bg-transparent transition-colors"
              >
                Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
