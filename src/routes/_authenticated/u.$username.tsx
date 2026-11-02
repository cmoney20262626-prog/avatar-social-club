import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ModelView } from "@/components/ModelView";
import { Initials } from "@/components/UserBadge";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/u/$username")({
  head: ({ params }) => ({ meta: [{ title: `@${params.username} — Avatarverse` }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { session, refreshProfile } = useAuth();
  const me = session!.user.id;
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [dn, setDn] = useState("");
  const [bio, setBio] = useState("");

  const { data } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
      if (!p) return null;
      const [avatar, followers, following, owned, posts, roles] = await Promise.all([
        p.equipped_avatar_id
          ? supabase.from("avatars").select("*").eq("id", p.equipped_avatar_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase.from("follows").select("follower_id").eq("following_id", p.id),
        supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", p.id),
        supabase.from("user_avatars").select("avatar_id, avatars(id, name, model_path)").eq("user_id", p.id),
        supabase.from("posts").select(POST_SELECT).eq("user_id", p.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", p.id),
      ]);
      return {
        p,
        avatar: avatar.data,
        followers: followers.data ?? [],
        followingCount: following.count ?? 0,
        owned: owned.data ?? [],
        posts: (posts.data ?? []) as unknown as FeedPost[],
        isAdmin: !!roles.data?.some((r) => r.role === "admin"),
      };
    },
  });

  if (data === undefined) return <p className="text-muted-foreground">Loading…</p>;
  if (data === null) return <p>User not found.</p>;

  const { p, avatar, followers, followingCount, owned, posts, isAdmin } = data;
  const isMe = p.id === me;
  const iFollow = followers.some((f) => f.follower_id === me);
  const refresh = () => qc.invalidateQueries({ queryKey: ["profile", username] });

  const toggleFollow = async () => {
    const { error } = iFollow
      ? await supabase.from("follows").delete().eq("follower_id", me).eq("following_id", p.id)
      : await supabase.from("follows").insert({ follower_id: me, following_id: p.id });
    if (error) toast.error(error.message);
    refresh();
  };

  const equip = async (id: string | null) => {
    const { error } = await supabase.rpc("equip_avatar", { _avatar_id: id as string });
    if (error) { toast.error(error.message); return; }
    toast.success(id ? "Avatar equipped!" : "Avatar removed");
    refresh();
    refreshProfile();
  };

  const save = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: dn, bio }).eq("id", me);
    if (error) { toast.error(error.message); return; }
    setEditing(false);
    refresh();
    refreshProfile();
  };

  return (
    <div className="grid gap-8 md:grid-cols-[320px_1fr]">
      <aside className="space-y-4">
        <div className="overflow-hidden rounded-2xl border bg-card">
          {avatar ? (
            <ModelView path={avatar.model_path} className="h-80 w-full" />
          ) : (
            <div className="flex h-80 items-center justify-center bg-stage">
              <Initials name={p.display_name || p.username} className="h-28 w-28 text-4xl" />
            </div>
          )}
          <div className="space-y-3 p-5">
            <div>
              <h1 className="text-2xl font-extrabold">{p.display_name || p.username}</h1>
              <p className="text-sm text-muted-foreground">@{p.username}</p>
              <div className="mt-2 flex gap-2">
                {isAdmin && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Admin</span>}
                {p.banned && <span className="rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">Banned</span>}
              </div>
            </div>
            {editing ? (
              <div className="space-y-2">
                <Input value={dn} onChange={(e) => setDn(e.target.value)} placeholder="Display name" />
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" />
                <Button size="sm" onClick={save}>Save</Button>
              </div>
            ) : (
              p.bio && <p className="text-sm">{p.bio}</p>
            )}
            <div className="flex gap-4 text-sm">
              <span><b>{followers.length}</b> <span className="text-muted-foreground">followers</span></span>
              <span><b>{followingCount}</b> <span className="text-muted-foreground">following</span></span>
            </div>
            {isMe ? (
              !editing && (
                <Button size="sm" variant="outline" onClick={() => { setDn(p.display_name ?? ""); setBio(p.bio ?? ""); setEditing(true); }}>
                  Edit profile
                </Button>
              )
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant={iFollow ? "outline" : "default"} onClick={toggleFollow}>
                  {iFollow ? "Unfollow" : "Follow"}
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/messages/$userId" params={{ userId: p.id }}>Message</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="mb-3 font-bold">Avatar collection ({owned.length})</h2>
          <div className="space-y-2">
            {owned.map((o) => (
              <div key={o.avatar_id} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-sm">
                <span>{o.avatars?.name}</span>
                {isMe && (p.equipped_avatar_id === o.avatar_id ? (
                  <Button size="sm" variant="ghost" onClick={() => equip(null)}>Unequip</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => equip(o.avatar_id)}>Equip</Button>
                ))}
              </div>
            ))}
            {owned.length === 0 && <p className="text-sm text-muted-foreground">No avatars yet.</p>}
          </div>
        </div>
      </aside>
      <section className="space-y-4">
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
        {posts.length === 0 && <p className="text-muted-foreground">No posts yet.</p>}
      </section>
    </div>
  );
}
