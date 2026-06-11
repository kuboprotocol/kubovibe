import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Refreshes signed avatar URLs before they expire.
 * Re-signs the avatars/{userId}/avatar.* path every `refreshMs` and on focus.
 */
export function useAvatarUrl(userId: string | undefined, initial?: string | null) {
  const [url, setUrl] = useState<string | null>(initial ?? null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    // List files for the user to find their current avatar
    const { data: list } = await supabase.storage.from("avatars").list(userId, { limit: 5 });
    const file = list?.find((f) => f.name.startsWith("avatar"));
    if (!file) return;
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(`${userId}/${file.name}`, 60 * 60 * 24 * 7); // 7 days
    if (signed?.signedUrl) {
      // Cache-bust to defeat <img> caching when the file changes
      setUrl(`${signed.signedUrl}&t=${Date.now()}`);
    }
  }, [userId]);

  useEffect(() => {
    if (initial) setUrl(initial);
  }, [initial]);

  useEffect(() => {
    if (!userId) return;
    refresh();
    // Refresh every 6 days (1 day before expiry)
    const interval = setInterval(refresh, 1000 * 60 * 60 * 24 * 6);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [userId, refresh]);

  return { url, refresh };
}
