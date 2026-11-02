import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthCtx {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  isAdmin: false,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setIsAdmin(false);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", s.user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", s.user.id),
    ]);
    setProfile(p ?? null);
    setIsAdmin(!!r?.some((x) => x.role === "admin"));
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => load(s), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const refreshProfile = useCallback(() => load(session), [load, session]);

  return (
    <Ctx.Provider value={{ session, profile, isAdmin, loading, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
