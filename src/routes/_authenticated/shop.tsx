import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ModelView } from "@/components/ModelView";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({ meta: [{ title: "Avatar Shop — Avatarverse" }] }),
  component: Shop,
});

function Shop() {
  const { session, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["shop"],
    queryFn: async () => {
      const [a, o] = await Promise.all([
        supabase.from("avatars").select("*").order("created_at", { ascending: false }),
        supabase.from("user_avatars").select("avatar_id").eq("user_id", session!.user.id),
      ]);
      return { avatars: a.data ?? [], owned: new Set((o.data ?? []).map((x) => x.avatar_id)) };
    },
  });

  const buy = async (id: string) => {
    const { error } = await supabase.rpc("buy_avatar", { _avatar_id: id });
    if (error) return toast.error(error.message);
    toast.success("Avatar unlocked! Equip it from your profile.");
    qc.invalidateQueries({ queryKey: ["shop"] });
    refreshProfile();
  };

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-extrabold">Avatar Shop</h1>
          <p className="mt-2 text-muted-foreground">Drag to spin. Spend coins to unlock.</p>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data?.avatars.map((a) => {
          const owned = data.owned.has(a.id);
          const canAfford = (profile?.coins ?? 0) >= a.price;
          return (
            <div key={a.id} className="overflow-hidden rounded-2xl border bg-card">
              <ModelView path={a.model_path} className="h-64 w-full" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">{a.name}</h3>
                  <span className="flex items-center gap-1 font-bold text-coin">
                    <Coins className="h-4 w-4" />
                    {a.price}
                  </span>
                </div>
                {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                <Button
                  className="w-full"
                  variant={owned ? "secondary" : "coin"}
                  disabled={owned || !canAfford}
                  onClick={() => buy(a.id)}
                >
                  {owned ? "Owned" : canAfford ? "Buy" : "Not enough coins"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {data && data.avatars.length === 0 && (
        <p className="text-muted-foreground">The shop is empty — check back soon.</p>
      )}
    </div>
  );
}
