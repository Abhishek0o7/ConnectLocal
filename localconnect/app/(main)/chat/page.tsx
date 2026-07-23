"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Message } from "@/lib/types/db";
import ConfettiBurst from "@/components/ConfettiBurst";
import Avatar from "@/components/Avatar";

const MILESTONES = [100, 30, 7];
function milestoneReached(streak: number): number | null {
  return MILESTONES.find((m) => streak >= m) ?? null;
}
function tierEmoji(streak: number): string {
  if (streak >= 100) return "🥇";
  if (streak >= 30) return "🥈";
  return "🥉";
}

type ChatSummary = {
  friend: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg" | "avatar_url" | "last_seen">;
  lastMessage: Message | null;
  unread: boolean;
  streak: number;
};

export default function ChatListPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [celebration, setCelebration] = useState(0);
  const [celebrationText, setCelebrationText] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: connections } = await supabase
      .from("connections")
      .select("requester_id, addressee_id, streak_count")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = (connections ?? []).map((c) =>
      c.requester_id === user.id ? c.addressee_id : c.requester_id
    );
    const streakByFriend = new Map<string, number>();
    (connections ?? []).forEach((c) => {
      const fid = c.requester_id === user.id ? c.addressee_id : c.requester_id;
      streakByFriend.set(fid, c.streak_count ?? 0);
    });

    if (friendIds.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const { data: friends } = await supabase
      .from("profiles")
      .select("id, name, initials, avatar_bg, avatar_fg, avatar_url, last_seen")
      .in("id", friendIds);

    const { data: messages } = await supabase
      .from("messages")
      .select("*")
      .or(
        friendIds
          .map(
            (fid) =>
              `and(sender_id.eq.${user.id},receiver_id.eq.${fid}),and(sender_id.eq.${fid},receiver_id.eq.${user.id})`
          )
          .join(",")
      )
      .order("created_at", { ascending: true });

    const summaries: ChatSummary[] = (friends ?? []).map((friend) => {
      const convo = (messages ?? []).filter(
        (m) =>
          (m.sender_id === user.id && m.receiver_id === friend.id) ||
          (m.sender_id === friend.id && m.receiver_id === user.id)
      );
      const lastMessage = convo.length ? convo[convo.length - 1] : null;
      const unread = convo.some((m) => m.receiver_id === user.id && !m.read_at);
      return { friend, lastMessage, unread, streak: streakByFriend.get(friend.id) ?? 0 };
    });

    summaries.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return bt - at;
    });

    setChats(summaries);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("chat-list-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  // Celebrate the first time a streak crosses 7 / 30 / 100 days, once per friend
  // (tracked in localStorage so it doesn't re-fire on every page load).
  useEffect(() => {
    for (const { friend, streak } of chats) {
      const reached = milestoneReached(streak);
      if (!reached) continue;
      const key = `lc_streak_ms_${friend.id}`;
      const seen = Number(localStorage.getItem(key) ?? "0");
      if (reached > seen) {
        localStorage.setItem(key, String(reached));
        setCelebrationText(`${friend.name} — ${reached}-day streak! ${tierEmoji(streak)}`);
        setCelebration((c) => c + 1);
        break; // celebrate one at a time
      }
    }
  }, [chats]);

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading conversations…</div>;
  }

  if (chats.length === 0) {
    return (
      <div className="text-center px-6 py-12">
        <div className="w-14 h-14 bg-surface2 rounded-full flex items-center justify-center mx-auto mb-3.5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
        </div>
        <div className="font-display text-[15px] font-medium text-ink mb-1.5">No conversations yet</div>
        <p className="text-[13px] text-muted leading-relaxed">
          Connect with people nearby, and once they accept, you can chat here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative">
      <ConfettiBurst trigger={celebration} />
      {celebration > 0 && celebrationText && (
        <div
          key={celebration}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-aurora text-white text-xs font-medium px-4 py-2 rounded-full pop-in shadow-lg"
        >
          {celebrationText}
        </div>
      )}
      {chats.map(({ friend, lastMessage, unread, streak }) => (
        <div
          key={friend.id}
          onClick={() => router.push(`/chat/${friend.id}`)}
          className="flex items-center gap-3 px-[18px] py-3.5 border-b border-hairline cursor-pointer hover:bg-surface2"
        >
          <div className="w-[46px] h-[46px] rounded-full flex-shrink-0">
            <Avatar url={friend.avatar_url} initials={friend.initials} bg={friend.avatar_bg} fg={friend.avatar_fg} size={46} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium font-display text-ink flex items-center gap-1.5">
              {friend.name}
              {streak >= 2 && (
                <span className="text-[11px] font-normal font-sans flex items-center gap-0.5">
                  <span className="flame-flicker">🔥</span>
                  <span className="text-yellow">{streak}</span>
                  {milestoneReached(streak) && <span>{tierEmoji(streak)}</span>}
                </span>
              )}
            </div>
            <div className="text-xs text-muted mt-0.5 truncate">
              {lastMessage ? lastMessage.content : "Say hi to your new neighbor!"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-[11px] text-muted">
              {lastMessage ? formatTime(lastMessage.created_at) : ""}
            </span>
            {unread && <div className="w-2 h-2 bg-primary rounded-full" />}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
