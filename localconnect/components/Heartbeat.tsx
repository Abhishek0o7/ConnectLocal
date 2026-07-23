"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

export default function Heartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let userId: string | null = null;

    async function ping() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      await supabase
        .from("profiles")
        .update({ last_seen: new Date().toISOString() })
        .eq("id", user.id);
    }

    ping();
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    // Ping immediately when the tab becomes visible again (e.g. user switches back).
    function handleVisibility() {
      if (document.visibilityState === "visible") ping();
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
