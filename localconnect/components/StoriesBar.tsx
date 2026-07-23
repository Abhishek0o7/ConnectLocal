"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Story } from "@/lib/types/db";
import Avatar from "@/components/Avatar";
import { uploadToBucket } from "@/lib/upload";

type Grouped = { authorId: string; author: Story["author"]; stories: Story[] };

export default function StoriesBar({ me }: { me: string }) {
  const supabase = createClient();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<Grouped | null>(null);
  const [viewIndex, setViewIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("stories")
      .select(
        "id, author_id, content, image_url, created_at, expires_at, author:profiles!stories_author_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url)"
      )
      .order("created_at", { ascending: true });
    if (!error) setStories((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("stories-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups: Grouped[] = [];
  for (const s of stories) {
    const g = groups.find((g) => g.authorId === s.author_id);
    if (g) g.stories.push(s);
    else groups.push({ authorId: s.author_id, author: s.author, stories: [s] });
  }
  // Bring my own story group first if it exists.
  groups.sort((a, b) => (a.authorId === me ? -1 : b.authorId === me ? 1 : 0));

  function openViewer(g: Grouped) {
    setViewing(g);
    setViewIndex(0);
  }

  useEffect(() => {
    if (!viewing) return;
    if (progressTimer.current) clearTimeout(progressTimer.current);
    progressTimer.current = setTimeout(() => {
      if (viewIndex < viewing.stories.length - 1) {
        setViewIndex((i) => i + 1);
      } else {
        setViewing(null);
      }
    }, 5000);
    return () => {
      if (progressTimer.current) clearTimeout(progressTimer.current);
    };
  }, [viewing, viewIndex]);

  async function handlePost() {
    if (!draft.trim() && !photoFile) return;
    setPosting(true);
    let image_url: string | null = null;
    if (photoFile) {
      image_url = await uploadToBucket(supabase, "stories", me, photoFile, "story");
    }
    await supabase.from("stories").insert({ author_id: me, content: draft.trim(), image_url });
    setPosting(false);
    setDraft("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setComposerOpen(false);
    load();
  }

  if (loading) return null;

  const myGroup = groups.find((g) => g.authorId === me);

  return (
    <>
      <div className="flex gap-3 px-[18px] py-3 overflow-x-auto">
        <button onClick={() => setComposerOpen(true)} className="flex flex-col items-center gap-1 flex-shrink-0 bg-transparent border-none">
          <div className="relative">
            {myGroup ? (
              <div className="aurora-ring">
                <Avatar url={myGroup.author.avatar_url} initials={myGroup.author.initials} bg={myGroup.author.avatar_bg} fg={myGroup.author.avatar_fg} size={56} />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-surface2 flex items-center justify-center text-xl text-muted">+</div>
            )}
          </div>
          <span className="text-[10px] text-muted">Your story</span>
        </button>

        {groups
          .filter((g) => g.authorId !== me)
          .map((g) => (
            <button
              key={g.authorId}
              onClick={() => openViewer(g)}
              className="flex flex-col items-center gap-1 flex-shrink-0 bg-transparent border-none"
            >
              <div className="aurora-ring">
                <Avatar url={g.author.avatar_url} initials={g.author.initials} bg={g.author.avatar_bg} fg={g.author.avatar_fg} size={56} />
              </div>
              <span className="text-[10px] text-muted max-w-[56px] truncate">{g.author.name}</span>
            </button>
          ))}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => {
            if (viewIndex < viewing.stories.length - 1) setViewIndex((i) => i + 1);
            else setViewing(null);
          }}
        >
          <div className="flex gap-1 p-3 flex-shrink-0">
            {viewing.stories.map((_, i) => (
              <div key={i} className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden">
                <div className={`h-full bg-white ${i === viewIndex ? "animate-[storyprogress_5s_linear]" : i < viewIndex ? "w-full" : "w-0"}`} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 pb-3 flex-shrink-0">
            <Avatar url={viewing.author.avatar_url} initials={viewing.author.initials} bg={viewing.author.avatar_bg} fg={viewing.author.avatar_fg} size={32} />
            <span className="text-white text-sm font-medium font-display">{viewing.author.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setViewing(null);
              }}
              className="ml-auto text-white/70 bg-transparent border-none text-lg"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4">
            {viewing.stories[viewIndex].image_url ? (
              <img src={viewing.stories[viewIndex].image_url!} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
            ) : (
              <p className="text-white text-xl font-display text-center leading-relaxed">
                {viewing.stories[viewIndex].content}
              </p>
            )}
          </div>
        </div>
      )}

      {composerOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center" onClick={() => setComposerOpen(false)}>
          <div
            className="glass bg-surface border border-hairline rounded-t-2xl sm:rounded-card w-full sm:w-[380px] p-4 pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-ink mb-2.5">Share a 24-hour story</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What's up?"
              className="w-full bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-20 text-ink mb-2.5"
            />
            {photoPreview && (
              <img src={photoPreview} alt="" className="w-full max-h-56 object-cover rounded-xl mb-2.5" />
            )}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted bg-surface2 border-none rounded-full px-3 py-1.5 cursor-pointer">
                📷
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
              <button
                onClick={handlePost}
                disabled={posting || (!draft.trim() && !photoFile)}
                className="flex-1 bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {posting ? "Posting…" : "Share story"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
