"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EventWithMeta } from "@/lib/types/db";
import EventCard from "@/components/EventCard";

type IncomingRequest = {
  id: string;
  eventTitle: string;
  requester: { id: string; name: string; initials: string; avatar_bg: string; avatar_fg: string };
};

export default function EventsPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const [me, setMe] = useState<string | null>(null);
  const [events, setEvents] = useState<EventWithMeta[]>([]);
  const [incoming, setIncoming] = useState<IncomingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data, error } = await supabase
      .from("events")
      .select(
        `id, host_id, title, description, location, starts_at, created_at,
         host:profiles!events_host_id_fkey(id, name, initials, avatar_bg, avatar_fg),
         event_requests(id, user_id, status)`
      )
      .order("starts_at", { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mapped: EventWithMeta[] = (data ?? []).map((row: any) => {
      const requests = row.event_requests ?? [];
      const mine = requests.find((r: any) => r.user_id === user.id);
      return {
        id: row.id,
        host_id: row.host_id,
        title: row.title,
        description: row.description,
        location: row.location,
        starts_at: row.starts_at,
        created_at: row.created_at,
        host: row.host,
        going_count: requests.filter((r: any) => r.status === "accepted").length + 1, // +1 for host
        my_request_status: row.host_id === user.id ? "accepted" : mine?.status ?? "none",
      };
    });

    setEvents(mapped);

    // Incoming join requests for events I host.
    const myEvents = mapped.filter((e) => e.host_id === user.id);
    if (myEvents.length > 0) {
      const { data: reqRows } = await supabase
        .from("event_requests")
        .select(
          `id, status, event_id, requester:profiles!event_requests_user_id_fkey(id, name, initials, avatar_bg, avatar_fg)`
        )
        .in(
          "event_id",
          myEvents.map((e) => e.id)
        )
        .eq("status", "pending");

      setIncoming(
        (reqRows ?? []).map((r: any) => ({
          id: r.id,
          eventTitle: myEvents.find((e) => e.id === r.event_id)?.title ?? "",
          requester: r.requester,
        }))
      );
    } else {
      setIncoming([]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("events-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "event_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  async function handleRequestJoin(eventId: string) {
    if (!me) return;
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, my_request_status: "pending" } : e))
    );
    const { error } = await supabase
      .from("event_requests")
      .insert({ event_id: eventId, user_id: me, status: "pending" });
    if (error) console.error(error);
  }

  async function handleAcceptRequest(requestId: string) {
    await supabase
      .from("event_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    load();
  }

  async function handleDeclineRequest(requestId: string) {
    await supabase
      .from("event_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    load();
  }

  async function handleCreateEvent() {
    setFormError(null);
    if (!title.trim() || !date || !location.trim()) {
      setFormError("Please fill in title, date, and location.");
      return;
    }
    if (!me) return;

    const startsAt = new Date(`${date}T${time || "09:00"}`);
    if (isNaN(startsAt.getTime())) {
      setFormError("Please enter a valid date and time.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("events").insert({
      host_id: me,
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      starts_at: startsAt.toISOString(),
    });
    setSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setDescription("");
    setCreatorOpen(false);
    load();
  }

  const filtered = q
    ? events.filter(
        (e) => e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q)
      )
    : events;

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading events…</div>;
  }

  return (
    <div>
      <div className="px-[18px] pt-4 pb-2">
        <span className="font-display text-sm font-semibold text-ink">Events near you</span>
      </div>

      <button
        onClick={() => setCreatorOpen((o) => !o)}
        className="bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium mx-[18px] mb-2.5 block w-[calc(100%-36px)]"
      >
        + Host an event
      </button>

      {creatorOpen && (
        <div className="bg-surface border border-hairline rounded-card mx-[18px] mb-3 p-4 flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Event title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none text-ink"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none text-ink"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="flex-1 bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none text-ink"
            />
          </div>
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none text-ink"
          />
          <textarea
            placeholder="Tell people about your event…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-16 text-ink"
          />
          {formError && <p className="text-red text-xs">{formError}</p>}
          <button
            onClick={handleCreateEvent}
            disabled={saving}
            className="bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create event"}
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="mx-[18px] mb-2.5 bg-yellow-light rounded-card p-3.5">
          <div className="font-display text-[13px] font-semibold text-yellow mb-2.5">
            Join requests for your events
          </div>
          <div className="flex flex-col gap-2">
            {incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-2.5 py-2 border-t border-yellow/20 first:border-t-0 first:pt-0">
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-xs font-semibold font-display flex-shrink-0"
                  style={{ background: r.requester.avatar_bg, color: r.requester.avatar_fg }}
                >
                  {r.requester.initials}
                </div>
                <div className="flex-1 text-xs text-ink">
                  <span className="font-medium">{r.requester.name}</span> wants to join{" "}
                  <em>{r.eventTitle}</em>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleAcceptRequest(r.id)}
                    className="bg-aurora text-white border-none rounded-full px-3 py-1 text-[11px] font-medium"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(r.id)}
                    className="bg-transparent text-muted border border-white/15 rounded-full px-2.5 py-1 text-[11px]"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-[18px] flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted text-sm py-8">No events yet — host the first one.</p>
        )}
        {filtered.map((event) => (
          <EventCard key={event.id} event={event} onRequestJoin={handleRequestJoin} />
        ))}
      </div>
    </div>
  );
}
