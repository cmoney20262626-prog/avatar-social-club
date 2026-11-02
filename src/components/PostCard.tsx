import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserLink } from "@/components/UserBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type FeedPost = {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profiles: { username: string; display_name: string | null } | null;
  likes: { user_id: string }[];
  comments: {
    id: string;
    content: string;
    created_at: string;
    user_id: string;
    profiles: { username: string; display_name: string | null } | null;
  }[];
};

export const POST_SELECT =
  "id, content, created_at, user_id, profiles(username, display_name), likes(user_id), comments(id, content, created_at, user_id, profiles(username, display_name))";

export function PostCard({ post }: { post: FeedPost }) {
  const { session, isAdmin } = useAuth();
  const qc = useQueryClient();
  const me = session?.user.id;
  const liked = post.likes.some((l) => l.user_id === me);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["posts"] });

  const toggleLike = async () => {
    const { error } = liked
      ? await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", me!)
      : await supabase.from("likes").insert({ post_id: post.id, user_id: me! });
    if (error) toast.error(error.message);
    refresh();
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: me!, content: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
    refresh();
  };

  const del = async () => {
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) toast.error(error.message);
    refresh();
  };

  const comments = [...post.comments].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <article className="rounded-2xl border bg-card p-5">
      <div className="flex items-start justify-between">
        {post.profiles && (
          <UserLink username={post.profiles.username} displayName={post.profiles.display_name} />
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {new Date(post.created_at).toLocaleString()}
          {(post.user_id === me || isAdmin) && (
            <button onClick={del} aria-label="Delete post" className="hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-[15px]">{post.content}</p>
      <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1 ${liked ? "text-accent" : "hover:text-foreground"}`}
        >
          <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
          {post.likes.length}
        </button>
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-foreground">
          <MessageSquare className="h-4 w-4" />
          {post.comments.length}
        </button>
      </div>
      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold">@{c.profiles?.username}</span>{" "}
              <span className="text-muted-foreground">{c.content}</span>
            </div>
          ))}
          <form onSubmit={addComment} className="flex gap-2">
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a comment…" />
            <Button type="submit" size="sm">
              Reply
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}
