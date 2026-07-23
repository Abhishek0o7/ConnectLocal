"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PostTag, PostWithMeta, ReactionCounts, ReactionEmoji } from "@/lib/types/db";
import PostCard from "@/components/PostCard";
import StoriesBar from "@/components/StoriesBar";
import { uploadToBucket } from "@/lib/upload";

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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
        `id, author_id, tag, content, photo_url, created_at,
         author:profiles!posts_author_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url),
         post_reactions(user_id, emoji),
         post_comments(id, post_id, author_id, content, created_at,
           author:profiles!post_comments_author_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url),
           comment_reactions(user_id, emoji))`
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const mapped: PostWithMeta[] = (data ?? []).map((row: any) => {
      const comments = (row.post_comments ?? [])
        .slice()
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((c: any) => {
          const cReactions = c.comment_reactions ?? [];
          const cCounts: ReactionCounts = {};
          cReactions.forEach((r: any) => {
            cCounts[r.emoji as ReactionEmoji] = (cCounts[r.emoji as ReactionEmoji] ?? 0) + 1;
          });
          const cMine = cReactions.find((r: any) => r.user_id === user.id);
          return {
            id: c.id,
            post_id: c.post_id,
            author_id: c.author_id,
            content: c.content,
            created_at: c.created_at,
            author: c.author,
            reaction_counts: cCounts,
            my_reaction: cMine?.emoji ?? null,
          };
        });
      const reactions = row.post_reactions ?? [];
      const reaction_counts: ReactionCounts = {};
      reactions.forEach((r: any) => {
        reaction_counts[r.emoji as ReactionEmoji] = (reaction_counts[r.emoji as ReactionEmoji] ?? 0) + 1;
      });
      const mine = reactions.find((r: any) => r.user_id === user.id);
      return {
        id: row.id,
        author_id: row.author_id,
        tag: row.tag,
        content: row.content,
        photo_url: row.photo_url,
        created_at: row.created_at,
        author: row.author,
        like_count: reactions.length,
        liked_by_me: !!mine,
        reaction_counts,
        my_reaction: mine?.emoji ?? null,
        comment_count: comments.length,
        comments,
      };
    });

    setPosts(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReact(postId: string, emoji: ReactionEmoji) {
    if (!me) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const previous = post.my_reaction;
    const isRemoving = previous === emoji;

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const counts = { ...p.reaction_counts };
        if (previous) counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
        if (!isRemoving) counts[emoji] = (counts[emoji] ?? 0) + 1;
        return { ...p, reaction_counts: counts, my_reaction: isRemoving ? null : emoji };
      })
    );

    if (isRemoving) {
      await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", me);
    } else {
      await supabase.from("post_reactions").upsert({ post_id: postId, user_id: me, emoji });
    }
  }

  async function handleReactComment(commentId: string, emoji: ReactionEmoji) {
    if (!me) return;
    let previous: ReactionEmoji | null = null;
    setPosts((prev) =>
      prev.map((p) => ({
        ...p,
        comments: p.comments.map((c) => {
          if (c.id !== commentId) return c;
          previous = c.my_reaction;
          const isRemoving = previous === emoji;
          const counts = { ...c.reaction_counts };
          if (previous) counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
          if (!isRemoving) counts[emoji] = (counts[emoji] ?? 0) + 1;
          return { ...c, reaction_counts: counts, my_reaction: isRemoving ? null : emoji };
        }),
      }))
    );
    const isRemoving = previous === emoji;
    if (isRemoving) {
      await supabase.from("comment_reactions").delete().eq("comment_id", commentId).eq("user_id", me);
    } else {
      await supabase.from("comment_reactions").upsert({ comment_id: commentId, user_id: me, emoji });
    }
  }

  async function handleSubmitPost() {
    const content = draft.trim();
    if (!content || !me) return;
    setPosting(true);
    let photo_url: string | null = null;
    if (photoFile) {
      photo_url = await uploadToBucket(supabase, "post-photos", me, photoFile, "post");
    }
    const { error } = await supabase.from("posts").insert({ author_id: me, tag, content, photo_url });
    setPosting(false);
    if (error) {
      console.error(error);
      return;
    }
    setDraft("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setComposerOpen(false);
    load();
  }

  async function handleAddComment(postId: string, content: string) {
    if (!me) return;
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, author_id: me, content })
      .select(
        "id, post_id, author_id, content, created_at, author:profiles!post_comments_author_id_fkey(id, name, initials, avatar_bg, avatar_fg, avatar_url)"
      )
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [...p.comments, { ...(data as any), reaction_counts: {}, my_reaction: null }],
              comment_count: p.comment_count + 1,
            }
          : p
      )
    );
  }

  async function handleDeleteComment(postId: string, commentId: string) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: p.comments.filter((c) => c.id !== commentId),
              comment_count: p.comment_count - 1,
            }
          : p
      )
    );
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
    if (error) {
      console.error(error);
      load();
    }
  }

  async function handleDeletePost(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) {
      console.error(error);
      load();
    }
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

      {me && <StoriesBar me={me} />}

      <button
        onClick={() => setComposerOpen((o) => !o)}
        className="bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium mx-[18px] mb-2.5 block w-[calc(100%-36px)]"
      >
        + Share something
      </button>

      {composerOpen && (
        <div className="glass bg-surface/60 border border-hairline rounded-card mx-[18px] mb-3 p-3.5 pop-in">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-20 text-ink"
          />
          {photoPreview && (
            <div className="relative mt-2">
              <img src={photoPreview} alt="" className="w-full max-h-56 object-cover rounded-xl" />
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
          <div className="flex items-center gap-2 mt-2.5">
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
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as PostTag)}
              className="flex-1 bg-surface2 border-none rounded-full px-3 py-1.5 text-xs outline-none text-ink"
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
              className="bg-aurora text-white border-none rounded-full px-4.5 py-2 text-sm font-medium disabled:opacity-60"
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
            me={me}
            isFriend={friendIds.has(post.author_id)}
            isOwner={post.author_id === me}
            onReact={handleReact}
            onReactComment={handleReactComment}
            onAddComment={handleAddComment}
            onDeleteComment={handleDeleteComment}
            onDeletePost={handleDeletePost}
            onBlocked={load}
          />
        ))}
      </div>
    </div>
  );
}
