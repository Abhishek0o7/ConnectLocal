"use client";

import type { EventWithMeta } from "@/lib/types/db";
import Avatar from "@/components/Avatar";

export default function EventCard({
  event,
  onRequestJoin,
}: {
  event: EventWithMeta;
  onRequestJoin: (eventId: string) => void;
}) {
  const start = new Date(event.starts_at);
  const day = start.getDate();
  const month = start.toLocaleDateString([], { month: "short" }).toUpperCase();
  const dateLabel = start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="glass bg-surface/60 border border-hairline rounded-card overflow-hidden pop-in">
      {event.photo_url && (
        <img src={event.photo_url} alt="" className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-aurora text-white rounded-xl px-3 py-2 text-center flex-shrink-0 font-display">
            <div className="text-[22px] font-semibold leading-none">{day}</div>
            <div className="text-[10px] opacity-90 mt-0.5">{month}</div>
          </div>
          <div className="flex-1">
            <div className="font-display text-sm font-semibold text-ink flex items-center gap-1.5">
              {event.title}
              {event.recurrence !== "none" && (
                <span className="text-[9px] font-normal font-sans text-muted bg-surface2 px-1.5 py-0.5 rounded-full">
                  ↻ {event.recurrence}
                </span>
              )}
            </div>
            <div className="text-xs text-muted mt-1 leading-relaxed">
              {dateLabel} · {timeLabel}
              <br />
              {event.location}
            </div>
            <div className="text-xs text-primary mt-0.5">by {event.host.name}</div>
          </div>
        </div>

        {event.description && (
          <div className="text-[13px] text-muted mb-2.5">{event.description}</div>
        )}

        {event.going_count > 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex -space-x-2">
              {event.going_previews.slice(0, 5).map((p) => (
                <div key={p.id} className="border-2 border-surface rounded-full">
                  <Avatar url={p.avatar_url} initials={p.initials} bg={p.avatar_bg} fg={p.avatar_fg} size={26} />
                </div>
              ))}
            </div>
            <span className="text-xs text-muted">{event.going_count} going</span>
          </div>
        )}

        {event.my_request_status === "accepted" ? (
          <div className="bg-primary-light rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="text-xs text-primary-dark flex-1 leading-snug">You're going to this event!</div>
            <button disabled className="bg-green-light text-green-dark border-none rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap">
              Going ✓
            </button>
          </div>
        ) : event.my_request_status === "pending" ? (
          <div className="bg-primary-light rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="text-xs text-primary-dark flex-1 leading-snug">Request sent. Waiting for host to accept.</div>
            <button disabled className="bg-yellow-light text-yellow border-none rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap">
              Pending…
            </button>
          </div>
        ) : (
          <div className="bg-primary-light rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2.5">
            <div className="text-xs text-primary-dark flex-1 leading-snug">Send a request to join this event</div>
            <button
              onClick={() => onRequestJoin(event.id)}
              className="bg-aurora text-white border-none rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap"
            >
              Request to join
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
