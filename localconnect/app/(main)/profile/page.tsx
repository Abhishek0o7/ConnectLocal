"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/db";

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
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold font-display"
          style={{ background: profile.avatar_bg, color: profile.avatar_fg }}
        >
          {profile.initials}
        </div>
        <div>
          <div className="font-display text-base font-semibold text-ink">{profile.name}</div>
          <div className="text-xs text-muted">{profile.area || "No area set"}</div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="text-xs text-muted font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-white border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2"
        />

        <label className="text-xs text-muted font-medium">Neighborhood / area</label>
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="bg-white border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2"
        />

        <label className="text-xs text-muted font-medium">Interests (comma separated)</label>
        <input
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="bg-white border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none -mt-2"
        />

        <label className="text-xs text-muted font-medium">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="bg-white border border-hairline rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-20 -mt-2"
        />

        {saved && <p className="text-green text-xs">Saved.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
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
