"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EventWithMeta, Recurrence } from "@/lib/types/db";
import EventCard from "@/components/EventCard";
import Avatar from "@/components/Avatar";
import { uploadToBucket } from "@/lib/upload";

type IncomingRequest = {
  id: string;
  eventTitle: string;
  requester: { id: string; name: string; initials: string; avatar_bg: string; avatar_fg: string; avatar_url: string | null };
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>("none");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data, error } = await supabase
      .from("events")
      .select(
        `id, host_id, title, description, location, starts_at, photo_url, recurrence, parent_event_id, created_at,
         host:profiles!events_host_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url),
         event_requests(id, user_id, status, requester:profiles!event_requests_user_id_fkey(id, initials, avatar_bg, avatar_fg, avatar_url))`
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
      const accepted = requests.filter((r: any) => r.status === "accepted");
      return {
        id: row.id,
        host_id: row.host_id,
        title: row.title,
        description: row.description,
        location: row.location,
        starts_at: row.starts_at,
        photo_url: row.photo_url,
        recurrence: row.recurrence,
        parent_event_id: row.parent_event_id,
        created_at: row.created_at,
        host: row.host,
        going_count: accepted.length + 1, // +1 for host
        going_previews: [row.host, ...accepted.map((r: any) => r.requester)],
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
          `id, status, event_id, requester:profiles!event_requests_user_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url)`
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
    let photo_url: string | null = null;
    if (photoFile) {
      photo_url = await uploadToBucket(supabase, "event-photos", me, photoFile, "event");
    }
    const { data: created, error } = await supabase
      .from("events")
      .insert({
        host_id: me,
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        starts_at: startsAt.toISOString(),
        photo_url,
        recurrence,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    if (recurrence !== "none" && created) {
      await supabase.rpc("generate_recurring_events", { p_event_id: created.id, p_count: 4 });
    }

    setTitle("");
    setDate("");
    setTime("");
    setLocation("");
    setDescription("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setRecurrence("none");
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
          {photoPreview && (
            <div className="relative">
              <img src={photoPreview} alt="" className="w-full max-h-40 object-cover rounded-xl" />
              <button
                onClick={() => {
                  setPhotoFile(null);
                  setPhotoPreview(null);
                }}
                className="absolute top-2 right-2 bg-black/60 text-white border-none rounded-full w-6 h-6 text-xs"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <label className="flex-1 text-xs text-muted bg-surface2 border-none rounded-xl px-3.5 py-2.5 cursor-pointer text-center">
              📷 {photoFile ? "Photo added" : "Add a cover photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPhotoFile(file);
                  setPhotoPreview(URL.createObjectURL(file));
                }}
              />
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className="bg-surface2 border-none rounded-xl px-3 py-2.5 text-xs outline-none text-ink"
            >
              <option value="none">Doesn't repeat</option>
              <option value="weekly">Repeats weekly</option>
              <option value="biweekly">Repeats biweekly</option>
              <option value="monthly">Repeats monthly</option>
            </select>
          </div>
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
                <div className="w-[34px] h-[34px] rounded-full flex-shrink-0">
                  <Avatar url={r.requester.avatar_url} initials={r.requester.initials} bg={r.requester.avatar_bg} fg={r.requester.avatar_fg} size={34} />
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
