"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NearbyProfile } from "@/lib/types/db";
import ReportBlockModal from "@/components/ReportBlockModal";
import Avatar from "@/components/Avatar";

type Status = "none" | "sent" | "friends";

export default function PersonCard({
  person,
  status,
  onConnect,
  onBlocked,
}: {
  person: NearbyProfile;
  status: Status;
  onConnect: (id: string) => void;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="glass bg-surface/60 border border-hairline rounded-card p-3.5 flex items-center gap-3 pop-in">
      <div className="aurora-ring flex-shrink-0 relative">
        <Avatar url={person.avatar_url} initials={person.initials} bg={person.avatar_bg} fg={person.avatar_fg} size={48} />
        <div className="w-[11px] h-[11px] bg-green rounded-full border-2 border-bg absolute bottom-0 right-0" />
        {person.mood_emoji && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface2 border border-hairline flex items-center justify-center text-[11px]">
            {person.mood_emoji}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium font-display text-ink">{person.name}</div>
        {person.mood_text && (
          <div className="text-[11px] text-gradient font-medium mt-0.5">{person.mood_text}</div>
        )}
        <div className="text-xs text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span className="bg-primary-light text-primary-dark text-[11px] px-2 py-0.5 rounded-full font-medium font-display">
            {person.distance_km.toFixed(1)} km
          </span>
          {person.area}
        </div>
        <div className="flex gap-1 flex-wrap mt-1.5">
          {person.interests.map((i) => (
            <span key={i} className="bg-surface2 text-muted text-[11px] px-2 py-0.5 rounded-lg">
              {i}
            </span>
          ))}
        </div>
      </div>

      {status === "friends" ? (
        <button
          onClick={() => router.push(`/chat/${person.id}`)}
          className="bg-green-light text-green-dark border-none rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          Chat
        </button>
      ) : status === "sent" ? (
        <button disabled className="bg-yellow-light text-yellow border-none rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap opacity-85">
          Sent
        </button>
      ) : (
        <button
          onClick={() => onConnect(person.id)}
          className="bg-aurora text-white border-none rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap"
        >
          Connect
        </button>
      )}

      <button
        onClick={() => setMenuOpen(true)}
        className="text-muted bg-transparent border-none p-1 flex-shrink-0"
        aria-label="More options"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>

      <ReportBlockModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        targetType="profile"
        targetId={person.id}
        personId={person.id}
        personName={person.name}
        onBlocked={onBlocked}
      />
    </div>
  );
}
