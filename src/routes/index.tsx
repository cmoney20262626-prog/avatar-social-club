import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Avatarverse — post, chat and collect 3D avatars" },
      { name: "description", content: "A social network where you collect 3D avatars with coins." },
      { property: "og:title", content: "Avatarverse" },
      { property: "og:description", content: "A social network where you collect 3D avatars with coins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session } = useAuth();
  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <span className="font-display text-2xl font-extrabold">
          avatar<span className="text-primary">verse</span>
        </span>
        <Button asChild variant="outline">
          <Link to={session ? "/feed" : "/auth"}>{session ? "Open app" : "Sign in"}</Link>
        </Button>
      </header>
      <section className="mx-auto flex max-w-5xl flex-1 flex-col justify-center px-4 py-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-accent">
          Social · 3D · Coins
        </p>
        <h1 className="max-w-3xl text-6xl font-extrabold leading-[0.95] sm:text-8xl">
          Be someone <span className="text-primary">new</span> today.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Post with friends, slide into DMs, claim daily coins and spend them on one-of-a-kind 3D
          avatars.
        </p>
        <div className="mt-10 flex gap-3">
          <Button asChild size="lg">
            <Link to={session ? "/feed" : "/auth"}>Get started</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
