"use client";

import type { EventWithMeta } from "@/lib/types/db";

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
    <div className="bg-white border border-hairline rounded-card p-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-primary text-white rounded-xl px-3 py-2 text-center flex-shrink-0 font-display">
          <div className="text-[22px] font-semibold leading-none">{day}</div>
          <div className="text-[10px] opacity-80 mt-0.5">{month}</div>
        </div>
        <div className="flex-1">
          <div className="font-display text-sm font-semibold text-ink">{event.title}</div>
          <div className="text-xs text-muted mt-1 leading-relaxed">
            {dateLabel} · {timeLabel}
            <br />
            {event.location}
          </div>
          <div className="text-xs text-primary mt-0.5">
            by {event.host.name} · {event.going_count} going
          </div>
        </div>
      </div>

      {event.description && (
        <div className="text-[13px] text-muted mb-2.5">{event.description}</div>
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
            className="bg-primary text-white border-none rounded-full px-4 py-2 text-xs font-medium whitespace-nowrap"
          >
            Request to join
          </button>
        </div>
      )}
    </div>
  );
}
