import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Initials } from "@/components/UserBadge";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — Avatarverse" }] }),
  component: Messages,
});

function Messages() {
  const { session } = useAuth();
  const me = session!.user.id;
  const [search, setSearch] = useState("");

  const { data: convos = [] } = useQuery({
    queryKey: ["convos"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      const seen = new Map<string, string>();
      for (const m of msgs ?? []) {
        const other = m.sender_id === me ? m.recipient_id : m.sender_id;
        if (!seen.has(other)) seen.set(other, m.content);
      }
      if (seen.size === 0) return [];
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", [...seen.keys()]);
      return [...seen.entries()].map(([id, last]) => ({ last, p: ps?.find((x) => x.id === id) }));
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["user-search", search],
    enabled: search.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .ilike("username", `%${search}%`)
        .neq("id", me)
        .limit(8);
      return data ?? [];
    },
  });

  const list = search.length > 1 ? results.map((p) => ({ p, last: "" })) : convos;

  return (
    <div className="grid h-[70vh] gap-4 md:grid-cols-[280px_1fr]">
      <aside className="flex flex-col overflow-hidden rounded-2xl border bg-card">
        <div className="border-b p-3">
          <Input placeholder="Find someone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map(({ p, last }) =>
            p ? (
              <Link
                key={p.id}
                to="/messages/$userId"
                params={{ userId: p.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary"
                activeProps={{ className: "bg-secondary" }}
              >
                <Initials name={p.display_name || p.username} />
                <div className="min-w-0">
                  <div className="font-semibold">{p.display_name || p.username}</div>
                  <div className="truncate text-xs text-muted-foreground">{last || `@${p.username}`}</div>
                </div>
              </Link>
            ) : null,
          )}
          {list.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">No conversations. Search for someone above.</p>
          )}
        </div>
      </aside>
      <section className="overflow-hidden rounded-2xl border bg-card">
        <Outlet />
      </section>
    </div>
  );
}
