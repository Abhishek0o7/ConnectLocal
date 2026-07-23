"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { NearbyProfile } from "@/lib/types/db";
import PersonCard from "@/components/PersonCard";
import RequestsPanel from "@/components/RequestsPanel";
import ConfettiBurst from "@/components/ConfettiBurst";
import Leaderboard from "@/components/Leaderboard";
import { notifyUser } from "@/lib/push-client";

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
  const [celebration, setCelebration] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [myMood, setMyMood] = useState<{ emoji: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("lat, lng, mood_emoji, mood_text")
      .eq("id", user.id)
      .single();

    if (!profile?.lat || !profile?.lng) {
      setNeedsLocation(true);
      setLoading(false);
      return;
    }

    setOrigin({ lat: profile.lat, lng: profile.lng });
    setMyMood(profile.mood_text ? { emoji: profile.mood_emoji, text: profile.mood_text } : null);

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
    const requester = incoming.find((r) => r.connectionId === connectionId);
    await supabase
      .from("connections")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", connectionId);
    setCelebration((c) => c + 1);
    if (requester) notifyUser(requester.id, "New connection!", "Someone nearby accepted your request 🎉", "/people");
    load();
  }

  async function handleDecline(connectionId: string) {
    await supabase
      .from("connections")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", connectionId);
    load();
  }

  const onlineOnly = people.filter(
    (p) => Date.now() - new Date(p.last_seen).getTime() < 5 * 60 * 1000
  );
  const visible = onlineOnly.filter((p) => !incoming.some((i) => i.id === p.id));
  const filtered = q
    ? visible.filter(
        (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
      )
    : visible;
  const vibeMatches = myMood
    ? visible.filter((p) => p.mood_text === myMood.text && p.id !== userId)
    : [];

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading people nearby…</div>;
  }

  if (needsLocation) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted mb-3">
          We need your location to show people nearby. Head to your profile to enable it.
        </p>
        <a href="/onboarding" className="text-gradient text-sm font-semibold">
          Set up location
        </a>
      </div>
    );
  }

  return (
    <div>
      <ConfettiBurst trigger={celebration} />
      <RequestsPanel requests={incoming} onAccept={handleAccept} onDecline={handleDecline} />

      {myMood && vibeMatches.length > 0 && (
        <div className="glass bg-aurora-soft border border-primary/30 rounded-card mx-[18px] mt-3 p-3 text-xs text-ink pop-in">
          {vibeMatches.length} {vibeMatches.length === 1 ? "person" : "people"} nearby {vibeMatches.length === 1 ? "is" : "are"} also{" "}
          <span className="text-gradient font-semibold">
            {myMood.emoji} {myMood.text}
          </span>{" "}
          right now
        </div>
      )}

      <div className="px-[18px] pt-4 pb-2 flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-ink">People nearby</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLeaderboard((s) => !s)}
            className="text-xs text-gradient font-semibold bg-transparent border-none"
          >
            🏆 Leaderboard
          </button>
          <span className="text-xs text-muted flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green inline-block" />
            {onlineOnly.length} online
          </span>
        </div>
      </div>

      {showLeaderboard && origin && <Leaderboard originLat={origin.lat} originLng={origin.lng} />}

      <div className="px-[18px] flex flex-col gap-2.5">
        {filtered.length === 0 && (
          <p className="text-center text-muted text-sm py-8">
            No one's online nearby right now — check back soon.
          </p>
        )}
        {filtered.map((p) => (
          <PersonCard
            key={p.id}
            person={p}
            status={statusMap[p.id] ?? "none"}
            onConnect={handleConnect}
            onBlocked={load}
          />
        ))}
      </div>
    </div>
  );
}
