"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const SUBTITLES: Record<string, string> = {
  "/people": "People within 5 km",
  "/chat": "Your conversations",
  "/feed": "What's happening nearby",
  "/events": "Events near you",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const basePath = "/" + (pathname?.split("/")[1] ?? "");
  const subtitle = SUBTITLES[basePath] ?? "Meet people near you";

  useEffect(() => {
    async function loadPending() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("addressee_id", user.id)
        .eq("status", "pending");

      setPendingCount(count ?? 0);
    }
    loadPending();

    const channel = supabase
      .channel("pending-connections")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () =>
        loadPending()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("q", value);
    else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const showSearch = ["/people", "/feed", "/events"].includes(basePath);

  return (
    <div className="bg-aurora px-5 pt-6 pb-4 sticky top-0 z-10">
      <div className="flex items-center justify-between mb-1">
        <div>
          <div className="font-display text-xl font-semibold text-white -tracking-wide">
            LocalConnect
          </div>
          <div className="text-xs text-white/70">{subtitle}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/people?tab=requests"
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center relative"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red text-white text-[9px] w-[17px] h-[17px] rounded-full flex items-center justify-center font-semibold border-2 border-primary">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </Link>
          <Link
            href="/profile"
            className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
      </div>

      {showSearch && (
        <div className="bg-white/15 border border-white/20 rounded-full px-4 py-2 flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search people, events…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-white text-sm placeholder-white/60 w-full"
          />
        </div>
      )}
    </div>
  );
}
