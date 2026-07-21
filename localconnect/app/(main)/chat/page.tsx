"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Message } from "@/lib/types/db";

type ChatSummary = {
  friend: Pick<Profile, "id" | "name" | "initials" | "avatar_bg" | "avatar_fg" | "last_seen">;
  lastMessage: Message | null;
  unread: boolean;
};

export default function ChatListPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<ChatSummary[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: connections } = await supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = (connections ?? []).map((c) =>
      c.requester_id === user.id ? c.addressee_id : c.requester_id
    );

    if (friendIds.length === 0) {
      setChats([]);
      setLoading(false);
      return;
    }

    const { data: friends } = await supabase
      .from("profiles")
      .select("id, name, initials, avatar_bg, avatar_fg, last_seen")
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
      return { friend, lastMessage, unread };
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

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading conversations…</div>;
  }

  if (chats.length === 0) {
    return (
      <div className="text-center px-6 py-12">
        <div className="w-14 h-14 bg-[#f0f0f8] rounded-full flex items-center justify-center mx-auto mb-3.5">
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
    <div className="flex flex-col">
      {chats.map(({ friend, lastMessage, unread }) => (
        <div
          key={friend.id}
          onClick={() => router.push(`/chat/${friend.id}`)}
          className="flex items-center gap-3 px-[18px] py-3.5 border-b border-hairline cursor-pointer hover:bg-primary-light"
        >
          <div
            className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-sm font-semibold font-display flex-shrink-0"
            style={{ background: friend.avatar_bg, color: friend.avatar_fg }}
          >
            {friend.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium font-display text-ink">{friend.name}</div>
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
