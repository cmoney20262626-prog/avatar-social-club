import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/messages/")({
  component: () => (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Pick a conversation
    </div>
  ),
});
