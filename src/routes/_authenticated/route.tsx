import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Home, ShoppingBag, MessageCircle, Gift, Shield, LogOut, User, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

function Shell() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav = [
    { to: "/feed", label: "Feed", icon: Home },
    { to: "/shop", label: "Shop", icon: ShoppingBag },
    { to: "/messages", label: "Messages", icon: MessageCircle },
    { to: "/redeem", label: "Coins", icon: Gift },
  ] as const;

  return (
    <div className="min-h-screen bg-hero">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <Link to="/feed" className="mr-4 font-display text-xl font-extrabold">
            avatar<span className="text-primary">verse</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <n.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-accent hover:bg-secondary"
                activeProps={{ className: "bg-secondary" }}
              >
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
          </nav>
          {profile && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-coin px-3 py-1 text-sm font-bold text-coin-foreground">
                <Coins className="h-4 w-4" />
                {profile.coins}
              </span>
              <Link
                to="/u/$username"
                params={{ username: profile.username }}
                className="rounded-full p-2 hover:bg-secondary"
                aria-label="My profile"
              >
                <User className="h-4 w-4" />
              </Link>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut />
          </Button>
        </div>
      </header>
      {profile?.banned && (
        <div className="bg-destructive px-4 py-2 text-center text-sm text-destructive-foreground">
          Your account has been banned. You can look around but can't post, chat or buy.
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
