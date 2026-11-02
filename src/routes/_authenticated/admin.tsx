import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ModelView } from "@/components/ModelView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Avatarverse" }] }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <p>Admins only.</p>;
  return (
    <div>
      <h1 className="mb-6 text-5xl font-extrabold">Admin panel</h1>
      <Tabs defaultValue="avatars">
        <TabsList>
          <TabsTrigger value="avatars">Avatars</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="cards">Gift cards</TabsTrigger>
        </TabsList>
        <TabsContent value="avatars"><AvatarsAdmin /></TabsContent>
        <TabsContent value="users"><UsersAdmin /></TabsContent>
        <TabsContent value="cards"><CardsAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

function AvatarsAdmin() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("100");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: avatars = [] } = useQuery({
    queryKey: ["admin-avatars"],
    queryFn: async () => (await supabase.from("avatars").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Pick a .glb file");
    setBusy(true);
    const path = `${crypto.randomUUID()}.glb`;
    const up = await supabase.storage
      .from("avatar-models")
      .upload(path, file, { contentType: "model/gltf-binary" });
    if (up.error) {
      setBusy(false);
      return toast.error(up.error.message);
    }
    const { error } = await supabase
      .from("avatars")
      .insert({ name, description: desc, price: Math.max(0, parseInt(price) || 0), model_path: path });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Avatar added to the shop!");
    setName(""); setDesc(""); setFile(null);
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["admin-avatars"] });
    qc.invalidateQueries({ queryKey: ["shop"] });
  };

  const remove = async (id: string, path: string) => {
    if (!confirm("Delete this avatar? Owners will lose it.")) return;
    await supabase.storage.from("avatar-models").remove([path]);
    const { error } = await supabase.from("avatars").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-avatars"] });
  };

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[340px_1fr]">
      <form onSubmit={upload} className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">Upload from Meshy</h2>
        <p className="text-xs text-muted-foreground">Export your model from Meshy as GLB, then upload it here.</p>
        <div className="space-y-1"><Label>Name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="space-y-1"><Label>Price (coins)</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        <div className="space-y-1"><Label>GLB file</Label><Input type="file" accept=".glb" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Uploading…" : "Add to shop"}</Button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {avatars.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-2xl border bg-card">
            <ModelView path={a.model_path} className="h-48 w-full" />
            <div className="flex items-center justify-between p-3">
              <div><div className="font-semibold">{a.name}</div><div className="text-xs text-coin">{a.price} coins</div></div>
              <Button size="icon" variant="ghost" onClick={() => remove(a.id, a.model_path)} aria-label="Delete"><Trash2 /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersAdmin() {
  const qc = useQueryClient();
  const { session, refreshProfile } = useAuth();
  const [q, setQ] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users", q],
    queryFn: async () => {
      let query = supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(100);
      if (q) query = query.ilike("username", `%${q}%`);
      const [{ data: ps }, { data: rs }] = await Promise.all([
        query,
        supabase.from("user_roles").select("user_id").eq("role", "admin"),
      ]);
      const admins = new Set((rs ?? []).map((r) => r.user_id));
      return (ps ?? []).map((p) => ({ ...p, isAdmin: admins.has(p.id) }));
    },
  });

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, msg: string) => {
    const { error } = await fn();
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    refreshProfile();
  };

  return (
    <div className="mt-4 space-y-4">
      <Input placeholder="Search username…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b"><th className="p-3">User</th><th className="p-3">Coins</th><th className="p-3">Gift coins</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="p-3">
                  <Link to="/u/$username" params={{ username: u.username }} className="font-semibold hover:underline">@{u.username}</Link>
                  <div className="mt-1 flex gap-1">
                    {u.isAdmin && <span className="rounded-full bg-accent px-2 text-xs text-accent-foreground">Admin</span>}
                    {u.banned && <span className="rounded-full bg-destructive px-2 text-xs text-destructive-foreground">Banned</span>}
                  </div>
                </td>
                <td className="p-3 font-bold text-coin">{u.coins}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      className="w-24"
                      placeholder="100"
                      value={amounts[u.id] ?? ""}
                      onChange={(e) => setAmounts({ ...amounts, [u.id]: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="coin"
                      onClick={() => {
                        const n = parseInt(amounts[u.id] ?? "");
                        if (!n) return toast.error("Enter an amount");
                        run(() => supabase.rpc("admin_gift_coins", { _user_id: u.id, _amount: n }), `Gave ${n} coins to @${u.username}`);
                        setAmounts({ ...amounts, [u.id]: "" });
                      }}
                    >
                      Gift
                    </Button>
                  </div>
                </td>
                <td className="p-3">
                  {u.id !== session?.user.id && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => run(() => supabase.rpc("admin_set_admin", { _user_id: u.id, _make: !u.isAdmin }), u.isAdmin ? "Admin removed" : "Made admin")}>
                        {u.isAdmin ? "Remove admin" : "Make admin"}
                      </Button>
                      <Button size="sm" variant={u.banned ? "secondary" : "destructive"} onClick={() => run(() => supabase.rpc("admin_set_ban", { _user_id: u.id, _banned: !u.banned }), u.banned ? "Unbanned" : "Banned")}>
                        {u.banned ? "Unban" : "Ban"}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CardsAdmin() {
  const qc = useQueryClient();
  const [coins, setCoins] = useState("500");

  const { data: cards = [] } = useQuery({
    queryKey: ["admin-cards"],
    queryFn: async () =>
      (await supabase.from("gift_cards").select("*, profiles(username)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    const { data, error } = await supabase.rpc("admin_create_gift_card", { _coins: parseInt(coins) || 0 });
    if (error) return toast.error(error.message);
    navigator.clipboard?.writeText(data).catch(() => {});
    toast.success(`Gift card ${data} created and copied!`);
    qc.invalidateQueries({ queryKey: ["admin-cards"] });
  };

  return (
    <div className="mt-4 space-y-4">
      <div className="flex max-w-md items-end gap-2 rounded-2xl border bg-card p-5">
        <div className="flex-1 space-y-1"><Label>Coins on card</Label><Input type="number" min={1} value={coins} onChange={(e) => setCoins(e.target.value)} /></div>
        <Button onClick={create}>Create gift card</Button>
      </div>
      <div className="space-y-2">
        {cards.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
            <span className="font-mono text-base">{c.code}</span>
            <span className="text-coin font-bold">{c.coins} coins</span>
            <span className="text-muted-foreground">
              {c.redeemed_by ? `Used by @${c.profiles?.username ?? "?"}` : "Unused"}
            </span>
            <Button size="icon" variant="ghost" aria-label="Copy" onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copied"); }}>
              <Copy />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
