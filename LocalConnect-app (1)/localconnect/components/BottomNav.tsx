"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const TABS = [
  { href: "/people", label: "Nearby", key: "people" },
  { href: "/chat", label: "Chat", key: "chat" },
  { href: "/feed", label: "Feed", key: "feed" },
  { href: "/events", label: "Events", key: "events" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadChats, setUnreadChats] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    let userId: string | null = null;

    async function loadUnread() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);

      setUnreadChats(count ?? 0);
    }

    loadUnread();

    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-hairline flex items-center justify-around z-20">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[64px] relative"
          >
            <TabIcon tabKey={tab.key} active={!!active} />
            {tab.key === "chat" && unreadChats > 0 && (
              <span className="absolute top-0 right-2 bg-red text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-semibold">
                {unreadChats > 9 ? "9+" : unreadChats}
              </span>
            )}
            <span className={`text-[11px] font-display ${active ? "text-primary font-medium" : "text-muted"}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function TabIcon({ tabKey, active }: { tabKey: string; active: boolean }) {
  const stroke = active ? "var(--p)" : "var(--muted)";
  const icons: Record<string, JSX.Element> = {
    people: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
    chat: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    feed: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    events: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  };
  return icons[tabKey];
}
