"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NearbyProfile } from "@/lib/types/db";
import PersonCard from "@/components/PersonCard";
import RequestsPanel from "@/components/RequestsPanel";

type StatusMap = Record<string, "none" | "sent" | "friends">;

export default function PeoplePage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const [loading, setLoading] = useState(true);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [people, setPeople] = useState<NearbyProfile[]>([]);
  const [statusMap, setStatusMap] = useState<StatusMap>({});
  const [incoming, setIncoming] = useState<(NearbyProfile & { connectionId: string })[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("lat, lng")
      .eq("id", user.id)
      .single();

    if (!profile?.lat || !profile?.lng) {
      setNeedsLocation(true);
      setLoading(false);
      return;
    }

    const { data: nearby, error: nearbyErr } = await supabase.rpc("nearby_profiles", {
      origin_lat: profile.lat,
      origin_lng: profile.lng,
      radius_km: 5,
    });

    if (nearbyErr) {
      console.error(nearbyErr);
      setLoading(false);
      return;
    }

    const list = (nearby ?? []) as NearbyProfile[];

    const { data: connections } = await supabase
      .from("connections")
      .select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const map: StatusMap = {};
    const incomingList: (NearbyProfile & { connectionId: string })[] = [];

    (connections ?? []).forEach((c) => {
      const otherId = c.requester_id === user.id ? c.addressee_id : c.requester_id;
      if (c.status === "accepted") {
        map[otherId] = "friends";
      } else if (c.status === "pending" && c.requester_id === user.id) {
        map[otherId] = "sent";
      } else if (c.status === "pending" && c.addressee_id === user.id) {
        const person = list.find((p) => p.id === otherId);
        if (person) incomingList.push({ ...person, connectionId: c.id });
      }
    });

    setPeople(list);
    setStatusMap(map);
    setIncoming(incomingList);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("people-connections")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, supabase]);

  async function handleConnect(otherId: string) {
    if (!userId) return;
    setStatusMap((s) => ({ ...s, [otherId]: "sent" }));
    const { error } = await supabase
      .from("connections")
      .insert({ requester_id: userId, addressee_id: otherId, status: "pending" });
    if (error) {
      console.error(error);
      setStatusMap((s) => ({ ...s, [otherId]: "none" }));
    }
  }

  async function handleAccept(connectionId: string) {
    await supabase
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", connectionId);
    load();
  }

  async function handleDecline(connectionId: string) {
    await supabase
      .from("connections")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", connectionId);
    load();
  }

  const visible = people.filter((p) => !incoming.some((i) => i.id === p.id));
  const filtered = q
    ? visible.filter(
        (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
      )
    : visible;

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading people nearby…</div>;
  }

  if (needsLocation) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted mb-3">
          We need your location to show people nearby. Head to your profile to enable it.
        </p>
        <a href="/onboarding" className="text-primary text-sm font-medium">
          Set up location
        </a>
      </div>
    );
  }

  return (
    <div>
      <RequestsPanel requests={incoming} onAccept={handleAccept} onDecline={handleDecline} />

      <div className="px-[18px] pt-4 pb-2 flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-ink">People nearby</span>
        <span className="text-xs text-muted">
          {people.filter((p) => Date.now() - new Date(p.last_seen).getTime() < 5 * 60 * 1000).length}{" "}
          online
        </span>
      </div>

      <div className="px-[18px] flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <p className="text-center text-muted text-sm py-8">No one matches your search yet.</p>
        )}
        {filtered.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            status={statusMap[p.id] ?? "none"}
            onConnect={handleConnect}
          />
        ))}
      </div>
    </div>
  );
}
