import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PostCard, POST_SELECT, type FeedPost } from "@/components/PostCard";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Feed — Avatarverse" }] }),
  component: Feed,
});

function Feed() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "following">("all");
  const [text, setText] = useState("");

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", tab],
    queryFn: async () => {
      let q = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false }).limit(50);
      if (tab === "following") {
        const { data: f } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", session!.user.id);
        const ids = [session!.user.id, ...(f ?? []).map((x) => x.following_id)];
        q = q.in("user_id", ids);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as FeedPost[];
    },
  });

  const post = async () => {
    if (!text.trim()) return;
    const { error } = await supabase
      .from("posts")
      .insert({ user_id: session!.user.id, content: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border bg-card p-5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's happening?"
          className="min-h-24 resize-none border-0 bg-transparent text-base focus-visible:ring-0"
          maxLength={1000}
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={post}>Post</Button>
        </div>
      </div>
      <div className="flex gap-2">
        {(["all", "following"] as const).map((t) => (
          <Button key={t} size="sm" variant={tab === t ? "secondary" : "ghost"} onClick={() => setTab(t)}>
            {t === "all" ? "Everyone" : "Following"}
          </Button>
        ))}
      </div>
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
      {posts.length === 0 && <p className="text-center text-muted-foreground">No posts yet.</p>}
    </div>
  );
}
