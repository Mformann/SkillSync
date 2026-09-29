import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
  error: string;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthState>({ session: null, loading: true, error: "", passwordRecovery: false, clearPasswordRecovery: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let active = true;
    let authVersion = 0;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      authVersion += 1;
      setSession(nextSession);
      setLoading(false);
      setError("");
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") setPasswordRecovery(false);
    });
    const versionAtStart = authVersion;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || authVersion !== versionAtStart) return;
      setSession(sessionError ? null : data.session);
      setError(sessionError ? "We couldn't restore your session. Please sign in again." : "");
      setLoading(false);
    }).catch(() => {
      if (!active || authVersion !== versionAtStart) return;
      setSession(null);
      setError("We couldn't restore your session. Please sign in again.");
      setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, loading, error, passwordRecovery, clearPasswordRecovery: () => setPasswordRecovery(false) }), [session, loading, error, passwordRecovery]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
