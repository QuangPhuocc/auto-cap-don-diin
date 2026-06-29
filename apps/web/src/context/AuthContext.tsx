import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

type AuthContextValue = { user: User | null; loading: boolean; login: (username: string, password: string) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { const token = localStorage.getItem("diin_token"); if (!token) { setLoading(false); return; } api<{user:User}>("/auth/me").then((r) => setUser(r.user)).finally(() => setLoading(false)); }, []);
  async function login(username: string, password: string) { const result = await api<{token:string;user:User}>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }); localStorage.setItem("diin_token", result.token); setUser(result.user); }
  function logout() { localStorage.removeItem("diin_token"); setUser(null); }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider missing"); return value; }
