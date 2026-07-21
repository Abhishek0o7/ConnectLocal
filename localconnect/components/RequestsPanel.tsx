"use client";

import type { NearbyProfile } from "@/lib/types/db";

export default function RequestsPanel({
  requests,
  onAccept,
  onDecline,
}: {
  requests: (NearbyProfile & { connectionId: string })[];
  onAccept: (connectionId: string) => void;
  onDecline: (connectionId: string) => void;
}) {
  if (requests.length === 0) return null;

  return (
    <div className="bg-primary-light rounded-card mx-[18px] mt-3 mb-1 p-3.5">
      <div className="font-display text-[13px] font-semibold text-primary-dark mb-2.5">
        Connection requests
      </div>
      <div className="flex flex-col">
        {requests.map((r) => (
          <div
            key={r.connectionId}
            className="flex items-center gap-2.5 py-2 border-t border-primary/15 first:border-t-0 first:pt-0"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold font-display flex-shrink-0"
              style={{ background: r.avatar_bg, color: r.avatar_fg }}
            >
              {r.initials}
            </div>
            <div className="flex-1 text-xs text-ink leading-snug">
              <span className="font-medium">{r.name}</span> wants to connect ·{" "}
              {r.distance_km.toFixed(1)} km away
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onAccept(r.connectionId)}
                className="bg-primary text-white border-none rounded-full px-3 py-1 text-[11px] font-medium"
              >
                Accept
              </button>
              <button
                onClick={() => onDecline(r.connectionId)}
                className="bg-transparent text-muted border border-black/15 rounded-full px-2.5 py-1 text-[11px]"
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
