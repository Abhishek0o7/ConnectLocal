"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PostTag, PostWithMeta } from "@/lib/types/db";
import PostCard from "@/components/PostCard";

export default function FeedPage() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").toLowerCase().trim();

  const [me, setMe] = useState<string | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tag, setTag] = useState<PostTag>("general");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const { data: connections } = await supabase
      .from("connections")
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    setFriendIds(
      new Set(
        (connections ?? []).map((c) => (c.requester_id === user.id ? c.addressee_id : c.requester_id))
      )
    );

    const { data, error } = await supabase
      .from("posts")
      .select(
        `id, author_id, tag, content, created_at,
         author:profiles!posts_author_id_fkey(id, name, initials, avatar_bg, avatar_fg),
         post_likes(user_id),
         post_comments(count)`
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mapped: PostWithMeta[] = (data ?? []).map((row: any) => ({
      id: row.id,
      author_id: row.author_id,
      tag: row.tag,
      content: row.content,
      created_at: row.created_at,
      author: row.author,
      like_count: row.post_likes?.length ?? 0,
      liked_by_me: (row.post_likes ?? []).some((l: any) => l.user_id === user.id),
      comment_count: row.post_comments?.[0]?.count ?? 0,
    }));

    setPosts(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggleLike(postId: string) {
    if (!me) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p
      )
    );

    if (post.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me);
    } else {
      await supabase.from("post_likes").insert({ post_id: postId, user_id: me });
    }
  }

  async function handleSubmitPost() {
    const content = draft.trim();
    if (!content || !me) return;
    setPosting(true);
    const { error } = await supabase.from("posts").insert({ author_id: me, tag, content });
    setPosting(false);
    if (error) {
      console.error(error);
      return;
    }
    setDraft("");
    setComposerOpen(false);
    load();
  }

  const filtered = q
    ? posts.filter(
        (p) => p.author.name.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)
      )
    : posts;

  if (loading) {
    return <div className="p-6 text-center text-muted text-sm">Loading the feed…</div>;
  }

  return (
    <div>
      <div className="px-[18px] pt-4 pb-2">
        <span className="font-display text-sm font-semibold text-ink">What's happening nearby</span>
      </div>

      <button
        onClick={() => setComposerOpen((o) => !o)}
        className="bg-primary text-white border-none rounded-full py-2.5 text-sm font-medium mx-[18px] mb-2.5 block w-[calc(100%-36px)]"
      >
        + Share something
      </button>

      {composerOpen && (
        <div className="bg-white border border-hairline rounded-card mx-[18px] mb-3 p-3.5">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-primary-light border-none rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-20 text-ink"
          />
          <div className="flex items-center gap-2 mt-2.5">
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as PostTag)}
              className="flex-1 bg-primary-light border-none rounded-full px-3 py-1.5 text-xs outline-none text-ink"
            >
              <option value="general">General</option>
              <option value="help">Help</option>
              <option value="found">Found</option>
              <option value="social">Social</option>
              <option value="sell">Buy/Sell</option>
            </select>
            <button
              onClick={handleSubmitPost}
              disabled={posting}
              className="bg-primary text-white border-none rounded-full px-4.5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      <div className="px-[18px] flex flex-col gap-3">
        {filtered.length === 0 && (
          <p className="text-center text-muted text-sm py-8">Nothing here yet — be the first to post.</p>
        )}
        {filtered.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            isFriend={friendIds.has(post.author_id)}
            onToggleLike={handleToggleLike}
          />
        ))}
      </div>
    </div>
  );
}
