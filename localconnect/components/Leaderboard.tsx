"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";

type Row = {
  id: string;
  name: string;
  initials: string;
  avatar_bg: string;
  avatar_fg: string;
  avatar_url: string | null;
  connection_count: number;
  best_streak: number;
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ originLat, originLng }: { originLat: number; originLng: number }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<"connections" | "streaks">("connections");

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc("nearby_leaderboard", { origin_lat: originLat, origin_lng: originLng, radius_km: 5 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error(error);
          setRows([]);
          return;
        }
        setRows((data ?? []) as Row[]);
      });
    return () => {
      cancelled = true;
    };
  }, [originLat, originLng, supabase]);

  const sorted = rows
    ? [...rows].sort((a, b) =>
        tab === "connections"
          ? b.connection_count - a.connection_count
          : b.best_streak - a.best_streak
      )
    : [];

  return (
    <div className="glass bg-surface/60 border border-hairline rounded-card mx-[18px] mb-3 p-3.5 pop-in">
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => setTab("connections")}
          className={`text-[11px] px-3 py-1 rounded-full border-none font-medium ${
            tab === "connections" ? "bg-aurora text-white" : "bg-surface2 text-muted"
          }`}
        >
          Most connected
        </button>
        <button
          onClick={() => setTab("streaks")}
          className={`text-[11px] px-3 py-1 rounded-full border-none font-medium ${
            tab === "streaks" ? "bg-aurora text-white" : "bg-surface2 text-muted"
          }`}
        >
          Longest streaks
        </button>
      </div>

      {rows === null && <p className="text-xs text-muted text-center py-3">Loading…</p>}
      {rows !== null && sorted.length === 0 && (
        <p className="text-xs text-muted text-center py-3">Not enough activity nearby yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {sorted.slice(0, 10).map((row, i) => (
          <div key={row.id} className="flex items-center gap-2.5">
            <span className="w-5 text-center text-xs font-medium text-muted">{MEDALS[i] ?? i + 1}</span>
            <div className="w-8 h-8 rounded-full flex-shrink-0">
              <Avatar url={row.avatar_url} initials={row.initials} bg={row.avatar_bg} fg={row.avatar_fg} size={32} />
            </div>
            <span className="flex-1 text-sm text-ink truncate">{row.name}</span>
            <span className="text-xs text-gradient font-semibold">
              {tab === "connections" ? `${row.connection_count} connections` : `${row.best_streak} 🔥`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
