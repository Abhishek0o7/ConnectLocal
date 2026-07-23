"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Message, Profile } from "@/lib/types/db";
import ReportBlockModal from "@/components/ReportBlockModal";
import Avatar from "@/components/Avatar";
import VoiceRecorder from "@/components/VoiceRecorder";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { uploadToBucket } from "@/lib/upload";
import { notifyUser } from "@/lib/push-client";

export default function ChatConversationPage() {
  const { userId: otherId } = useParams<{ userId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [me, setMe] = useState<string | null>(null);
  const [friend, setFriend] = useState<Pick<
    Profile,
    "id" | "name" | "initials" | "avatar_bg" | "avatar_fg" | "avatar_url" | "last_seen"
  > | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [canMessage, setCanMessage] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);

      const { data: friendProfile } = await supabase
        .from("profiles")
        .select("id, name, initials, avatar_bg, avatar_fg, avatar_url, last_seen")
        .eq("id", otherId)
        .single();
      setFriend(friendProfile);

      const { data: connection } = await supabase
        .from("connections")
        .select("status")
        .or(
          `and(requester_id.eq.${user.id},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${user.id})`
        )
        .maybeSingle();
      setCanMessage(connection?.status === "accepted");

      const { data: existing } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
        )
        .order("created_at", { ascending: true });
      setMessages(existing ?? []);
      setLoading(false);

      // Mark incoming messages as read.
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("sender_id", otherId)
        .eq("receiver_id", user.id)
        .is("read_at", null);

      channel = supabase
        .channel(`messages-${user.id}-${otherId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const m = payload.new as Message;
            const belongs =
              (m.sender_id === user.id && m.receiver_id === otherId) ||
              (m.sender_id === otherId && m.receiver_id === user.id);
            if (belongs) setMessages((prev) => [...prev, m]);
          }
        )
        .subscribe();
    }

    init();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const content = draft.trim();
    if (!content || !me) return;
    setDraft("");
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: otherId, content });
    if (error) console.error(error);
    else notifyUser(otherId, friend?.name ? `Message from someone nearby` : "New message", content, `/chat/${me}`);
  }

  async function handleSendVoiceNote(blob: Blob, seconds: number, mimeType: string) {
    if (!me) return;
    const url = await uploadToBucket(supabase, "voice-notes", me, blob, "voice", mimeType);
    if (!url) return;
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: otherId, content: "", audio_url: url, audio_seconds: seconds });
    if (error) console.error(error);
    else notifyUser(otherId, "New voice note", "🎙️ Sent you a voice note", `/chat/${me}`);
  }

  async function handleSendPhoto(file: File) {
    if (!me) return;
    const url = await uploadToBucket(supabase, "chat-photos", me, file, "photo");
    if (!url) return;
    const { error } = await supabase
      .from("messages")
      .insert({ sender_id: me, receiver_id: otherId, content: "", photo_url: url });
    if (error) console.error(error);
    else notifyUser(otherId, "New photo", "📷 Sent you a photo", `/chat/${me}`);
  }

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading conversation…</div>;
  }

  return (
    <div className="fixed inset-0 bg-bg flex flex-col z-30">
      <div className="bg-aurora px-4 pt-5 pb-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => router.push("/chat")} className="text-white flex items-center gap-1">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        {friend && (
          <div className="w-9 h-9 rounded-full flex-shrink-0">
            <Avatar url={friend.avatar_url} initials={friend.initials} bg={friend.avatar_bg} fg={friend.avatar_fg} size={36} />
          </div>
        )}
        <div className="flex-1">
          <div className="font-display text-[15px] font-semibold text-white">
            {friend?.name ?? "Conversation"}
          </div>
          <div className="text-[11px] text-white/70">
            {friend && isOnline(friend.last_seen) ? "Online" : "Offline"}
          </div>
        </div>
        {friend && (
          <button
            onClick={() => setReportOpen(true)}
            className="text-white/80 bg-transparent border-none p-1"
            aria-label="More options"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        )}
      </div>

      {friend && (
        <ReportBlockModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="profile"
          targetId={friend.id}
          personId={friend.id}
          personName={friend.name}
          onBlocked={() => router.push("/chat")}
        />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="text-center text-muted text-sm py-6">Start the conversation!</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed pop-in ${
              m.sender_id === me
                ? "bg-aurora text-white self-end rounded-br-md"
                : "glass bg-surface/60 text-ink self-start rounded-bl-md border border-hairline"
            }`}
          >
            {m.photo_url ? (
              <img src={m.photo_url} alt="" className="max-w-full rounded-xl -m-1 mb-1" style={{ maxHeight: 260 }} />
            ) : m.audio_url ? (
              <VoiceNotePlayer url={m.audio_url} seconds={m.audio_seconds} mine={m.sender_id === me} />
            ) : (
              <div>{m.content}</div>
            )}
            <div className="text-[10px] opacity-60 mt-1">{formatTime(m.created_at)}</div>
          </div>
        ))}
      </div>

      {canMessage ? (
        <div className="p-3 glass bg-surface/80 border-t border-hairline flex gap-2.5 items-center flex-shrink-0">
          <VoiceRecorder onRecorded={handleSendVoiceNote} />
          <label className="bg-surface2 text-ink border-none rounded-full w-[38px] h-[38px] flex items-center justify-center flex-shrink-0 cursor-pointer">
            📷
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSendPhoto(file);
                e.target.value = "";
              }}
            />
          </label>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message…"
            className="flex-1 bg-surface2 border-none rounded-full px-4 py-2.5 text-sm outline-none text-ink"
          />
          <button
            onClick={handleSend}
            className="bg-aurora text-white border-none rounded-full w-[38px] h-[38px] flex items-center justify-center flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="p-4 text-center text-xs text-muted glass bg-surface/80 border-t border-hairline">
          You can message once you're both connected.
        </div>
      )}
    </div>
  );
}

function isOnline(lastSeen: string) {
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
