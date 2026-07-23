"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [area, setArea] = useState("");
  const [interests, setInterests] = useState("");
  const [locStatus, setLocStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function requestLocation() {
    setLocStatus("requesting");
    if (!("geolocation" in navigator)) {
      setLocStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("granted");
      },
      () => setLocStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Session expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        area,
        interests: interests
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push("/people");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-semibold text-gradient">Set up your profile</h1>
          <p className="text-muted text-sm mt-1">
            This helps us show you people and events actually nearby.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            required
            placeholder="Neighborhood / area (e.g. Green Park)"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className="bg-surface2 border border-hairline rounded-xl px-4 py-3 text-sm outline-none focus:border-primary text-ink"
          />
          <input
            type="text"
            placeholder="Interests, comma separated (e.g. Yoga, Cooking)"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            className="bg-surface2 border border-hairline rounded-xl px-4 py-3 text-sm outline-none focus:border-primary text-ink"
          />

          <div className="bg-primary-light rounded-xl p-4 text-sm">
            {locStatus === "granted" ? (
              <p className="text-primary-dark">Location captured — you're set.</p>
            ) : (
              <>
                <p className="text-primary-dark mb-2">
                  Share your location so nearby people can find you.
                </p>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="bg-aurora text-white rounded-full px-4 py-2 text-xs font-medium"
                >
                  {locStatus === "requesting" ? "Requesting…" : "Enable location"}
                </button>
                {locStatus === "denied" && (
                  <p className="text-red text-xs mt-2">
                    Location wasn't shared. You can still continue and update this later in your
                    profile.
                  </p>
                )}
              </>
            )}
          </div>

          {error && <p className="text-red text-xs">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-aurora text-white rounded-full py-3 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
