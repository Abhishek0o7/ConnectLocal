"use client";

import { useRouter } from "next/navigation";
import { TAG_STYLES, type PostWithMeta } from "@/lib/types/db";

export default function PostCard({
  post,
  isFriend,
  onToggleLike,
}: {
  post: PostWithMeta;
  isFriend: boolean;
  onToggleLike: (postId: string) => void;
}) {
  const router = useRouter();
  const tag = TAG_STYLES[post.tag];

  return (
    <div className="bg-white border border-hairline rounded-card p-4">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold font-display flex-shrink-0"
          style={{ background: post.author.avatar_bg, color: post.author.avatar_fg }}
        >
          {post.author.initials}
        </div>
        <div>
          <div className="text-sm font-medium font-display text-ink">{post.author.name}</div>
          <div className="text-[11px] text-muted mt-0.5 flex gap-1.5 items-center">
            {timeAgo(post.created_at)}
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-lg"
              style={{ background: tag.bg, color: tag.col }}
            >
              {tag.label}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-ink leading-relaxed mb-3">{post.content}</div>

      <div className="flex gap-4 items-center">
        <button
          onClick={() => onToggleLike(post.id)}
          className={`flex items-center gap-1.5 text-xs bg-transparent border-none ${
            post.liked_by_me ? "text-red" : "text-muted"
          }`}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={post.liked_by_me ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
          <span>{post.like_count}</span>
        </button>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {post.comment_count}
        </span>
        {isFriend && (
          <button
            onClick={() => router.push(`/chat/${post.author.id}`)}
            className="ml-auto text-xs text-muted bg-transparent border-none"
          >
            Reply in chat →
          </button>
        )}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
