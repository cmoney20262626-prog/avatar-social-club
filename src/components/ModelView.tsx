import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "model-viewer": any;
    }
  }
}

export function useModelUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["model-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 50,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("avatar-models")
        .createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

export function ModelView({
  path,
  className,
  autoRotate = true,
  interactive = true,
}: {
  path: string | null | undefined;
  className?: string;
  autoRotate?: boolean;
  interactive?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const { data: url } = useModelUrl(path);

  useEffect(() => {
    import("@google/model-viewer").then(() => setReady(true));
  }, []);

  return (
    <div className={cn("relative overflow-hidden bg-stage", className)}>
      {ready && url ? (
        <model-viewer
          src={url}
          alt="3D avatar"
          camera-controls={interactive ? true : undefined}
          auto-rotate={autoRotate ? true : undefined}
          disable-zoom
          shadow-intensity="1"
          style={{ width: "100%", height: "100%", background: "transparent" }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
          Loading…
        </div>
      )}
    </div>
  );
}
