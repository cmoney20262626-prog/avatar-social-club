import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/redeem")({
  head: () => ({ meta: [{ title: "Get coins — Avatarverse" }] }),
  component: Redeem,
});

function Redeem() {
  const { profile, refreshProfile } = useAuth();
  const [code, setCode] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const claimed = profile?.last_daily_claim != null && profile.last_daily_claim >= today;

  const daily = async () => {
    const { data, error } = await supabase.rpc("claim_daily");
    if (error) { toast.error(error.message); return; }
    toast.success(`+${data} coins!`);
    refreshProfile();
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase.rpc("redeem_gift_card", { _code: code });
    if (error) { toast.error(error.message); return; }
    toast.success(`Gift card redeemed: +${data} coins!`);
    setCode("");
    refreshProfile();
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-5xl font-extrabold">Get coins</h1>
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <Sun className="h-6 w-6 text-coin" />
          <h2 className="text-xl font-bold">Daily bonus</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Come back every day for 50 free coins.</p>
        <Button variant="coin" className="mt-4" disabled={claimed} onClick={daily}>
          {claimed ? "Claimed today — come back tomorrow" : "Claim 50 coins"}
        </Button>
      </div>
      <form onSubmit={redeem} className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-accent" />
          <h2 className="text-xl font-bold">Redeem a gift card</h2>
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX"
            className="font-mono"
            required
          />
          <Button type="submit">Redeem</Button>
        </div>
      </form>
    </div>
  );
}
