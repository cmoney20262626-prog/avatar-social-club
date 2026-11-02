import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserLink } from "@/components/UserBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/messages/$userId")({
  component: Chat,
});

function Chat() {
  const { userId } = Route.useParams();
  const { session } = useAuth();
  const me = session!.user.id;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const { data: other } = useQuery({
    queryKey: ["p-by-id", userId],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, username, display_name").eq("id", userId).maybeSingle()).data,
  });

  const { data: msgs = [] } = useQuery({
    queryKey: ["chat", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`and(sender_id.eq.${me},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${me})`)
        .order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`chat-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["chat", userId] });
        qc.invalidateQueries({ queryKey: ["convos"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me, recipient_id: userId, content: text.trim() });
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["chat", userId] });
    qc.invalidateQueries({ queryKey: ["convos"] });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        {other && <UserLink username={other.username} displayName={other.display_name} />}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.sender_id === me ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.sender_id === me ? "bg-primary text-primary-foreground" : "bg-secondary"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t p-3">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message…" />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
