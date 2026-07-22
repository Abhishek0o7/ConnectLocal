"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { VIBE_OPTIONS, type Profile } from "@/lib/types/db";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingMood, setSettingMood] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setProfile(data);
        setName(data.name);
        setArea(data.area);
        setBio(data.bio);
        setInterests((data.interests ?? []).join(", "));
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({
        name,
        area,
        bio,
        interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
      })
      .eq("id", profile.id);
    setSaving(false);
    if (!error) setSaved(true);
  }

  async function handleSetVibe(emoji: string, text: string) {
    if (!profile) return;
    setProfile({ ...profile, mood_emoji: emoji, mood_text: text });
    setSettingMood(false);
    await supabase
      .from("profiles")
      .update({ mood_emoji: emoji, mood_text: text, mood_set_at: new Date().toISOString() })
      .eq("id", profile.id);
  }

  async function handleClearVibe() {
    if (!profile) return;
    setProfile({ ...profile, mood_emoji: null, mood_text: null });
    await supabase
      .from("profiles")
      .update({ mood_emoji: null, mood_text: null, mood_set_at: null })
      .eq("id", profile.id);
  }

  async function handleUpdateLocation() {
    if (!("geolocation" in navigator) || !profile) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await supabase
        .from("profiles")
        .update({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        .eq("id", profile.id);
      setSaved(true);
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading || !profile) {
    return <div className="p-6 text-center text-muted text-sm">Loading profile…</div>;
  }

  return (
    <div className="px-[18px] py-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="aurora-ring flex-shrink-0">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold font-display"
            style={{ background: profile.avatar_bg, color: profile.avatar_fg }}
          >
            {profile.initials}
          </div>
        </div>
        <div>
          <div className="font-display text-base font-semibold text-ink">{profile.name}</div>
          <div className="text-xs text-muted">{profile.area || "No area set"}</div>
        </div>
      </div>

      {/* Vibe / mood status — a quick, screenshot-able status shown on your card to nearby people */}
      <div className="glass bg-surface/60 border border-hairline rounded-card p-3.5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted">Your vibe right now</span>
          {profile.mood_emoji && (
            <button onClick={handleClearVibe} className="text-[11px] text-muted bg-transparent border-none">
              Clear
            </button>
          )}
        </div>
        {profile.mood_emoji ? (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{profile.mood_emoji}</span>
            <span className="text-sm text-gradient font-medium">{profile.mood_text}</span>
          </div>
        ) : (
          <p className="text-xs text-muted mb-2">No vibe set — pick one so people know what you're up to.</p>
        )}
        <button
          onClick={() => setSettingMood((s) => !s)}
          className="text-xs font-medium text-primary-dark bg-primary-light border-none rounded-full px-3 py-1.5"
        >
          {settingMood ? "Cancel" : profile.mood_emoji ? "Change vibe" : "Set a vibe"}
        </button>
        {settingMood && (
          <div className="grid grid-cols-4 gap-2 mt-3 pop-in">
            {VIBE_OPTIONS.map((v) => (
              <button
                key={v.text}
                onClick={() => handleSetVibe(v.emoji, v.text)}
                className="flex flex-col items-center gap-1 bg-surface2 border-none rounded-xl py-2.5 hover:bg-primary-light"
              >
                <span className="text-lg">{v.emoji}</span>
                <span className="text-[9px] text-muted text-center leading-tight">{v.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs text-muted font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-surface2 border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2 text-ink"
        />

        <label className="text-xs text-muted font-medium">Neighborhood / area</label>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="bg-surface2 border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2 text-ink"
        />

        <label className="text-xs text-muted font-medium">Interests (comma separated)</label>
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="bg-surface2 border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2 text-ink"
        />

        <label className="text-xs text-muted font-medium">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="bg-surface2 border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-20 -mt-2 text-ink"
        />

        {saved && <p className="text-green text-xs">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>

        <button
          onClick={handleUpdateLocation}
          className="bg-primary-light text-primary-dark border-none rounded-full py-2.5 text-sm font-medium"
        >
          Update my location
        </button>

        <button
          onClick={handleLogout}
          className="bg-transparent text-red border border-red/30 rounded-full py-2.5 text-sm font-medium mt-2"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
