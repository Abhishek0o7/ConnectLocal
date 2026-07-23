"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REACTION_EMOJIS, TAG_STYLES, type PostWithMeta, type ReactionEmoji } from "@/lib/types/db";
import ReportBlockModal from "@/components/ReportBlockModal";
import Avatar from "@/components/Avatar";

export default function PostCard({
  post,
  me,
  isFriend,
  isOwner,
  onReact,
  onReactComment,
  onAddComment,
  onDeleteComment,
  onDeletePost,
  onBlocked,
}: {
  post: PostWithMeta;
  me: string | null;
  isFriend: boolean;
  isOwner: boolean;
  onReact: (postId: string, emoji: ReactionEmoji) => void;
  onReactComment: (commentId: string, emoji: ReactionEmoji) => void;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onDeleteComment: (postId: string, commentId: string) => void;
  onDeletePost: (postId: string) => void;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const tag = TAG_STYLES[post.tag];
  const [showComments, setShowComments] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  async function handleSubmitComment() {
    const content = draft.trim();
    if (!content) return;
    setPosting(true);
    await onAddComment(post.id, content);
    setPosting(false);
    setDraft("");
  }

  const totalReactions = Object.values(post.reaction_counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="glass bg-surface/60 border border-hairline rounded-card p-4 pop-in">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold font-display flex-shrink-0"
        >
          <Avatar url={post.author.avatar_url} initials={post.author.initials} bg={post.author.avatar_bg} fg={post.author.avatar_fg} size={40} />
        </div>
        <div className="flex-1">
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

        {isOwner &&
          (confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onDeletePost(post.id)}
                className="text-[11px] text-white bg-red border-none rounded-full px-2.5 py-1 font-medium"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-[11px] text-muted bg-transparent border-none"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-muted bg-transparent border-none p-1"
              aria-label="Delete post"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
            </button>
          ))}

        {!isOwner && (
          <button
            onClick={() => setReportOpen(true)}
            className="text-muted bg-transparent border-none p-1"
            aria-label="More options"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        )}
      </div>

      <ReportBlockModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        personId={post.author_id}
        personName={post.author.name}
        onBlocked={onBlocked}
      />

      <div className="text-sm text-ink leading-relaxed mb-3">{post.content}</div>

      {post.photo_url && (
        <img
          src={post.photo_url}
          alt=""
          className="w-full rounded-xl mb-3 max-h-96 object-cover"
        />
      )}

      {totalReactions > 0 && (
        <div className="flex gap-1 flex-wrap mb-2.5">
          {REACTION_EMOJIS.filter((e) => (post.reaction_counts[e] ?? 0) > 0).map((e) => (
            <span
              key={e}
              className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
                post.my_reaction === e ? "bg-aurora-soft border border-primary/40" : "bg-surface2"
              }`}
            >
              {e} {post.reaction_counts[e]}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-4 items-center relative">
        <div className="relative">
          <button
            onClick={() => setShowPicker((s) => !s)}
            className={`flex items-center gap-1.5 text-xs bg-transparent border-none ${
              post.my_reaction ? "text-gradient font-semibold" : "text-muted"
            }`}
          >
            <span className="text-sm">{post.my_reaction ?? "🔥"}</span>
            <span>React</span>
          </button>
          {showPicker && (
            <div className="absolute bottom-full mb-2 left-0 glass bg-surface2 border border-hairline rounded-full px-2 py-1.5 flex gap-1.5 z-10 pop-in">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    onReact(post.id, e);
                    setShowPicker(false);
                  }}
                  className="text-lg leading-none bg-transparent border-none hover:scale-125 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-muted bg-transparent border-none"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {post.comment_count}
        </button>
        {isFriend && (
          <button
            onClick={() => router.push(`/chat/${post.author.id}`)}
            className="ml-auto text-xs text-muted bg-transparent border-none"
          >
            Reply in chat →
          </button>
        )}
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-hairline flex flex-col gap-2.5">
          {post.comments.length === 0 && (
            <p className="text-xs text-muted">No comments yet — be the first to reply.</p>
          )}
          {post.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full flex-shrink-0">
                <Avatar url={c.author.avatar_url} initials={c.author.initials} bg={c.author.avatar_bg} fg={c.author.avatar_fg} size={28} />
              </div>
              <div className="flex-1 bg-surface2 rounded-xl px-3 py-2">
                <div className="text-[11px] font-medium text-ink font-display">{c.author.name}</div>
                <div className="text-xs text-ink mt-0.5 leading-relaxed">{c.content}</div>
                <CommentReactions comment={c} onReact={onReactComment} />
              </div>
              {c.author_id === me && (
                <button
                  onClick={() => onDeleteComment(post.id, c.id)}
                  className="text-muted bg-transparent border-none text-[11px] mt-1.5"
                  aria-label="Delete comment"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <div className="flex gap-2 items-center mt-1">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
              placeholder="Write a comment…"
              className="flex-1 bg-primary-light border-none rounded-full px-3.5 py-2 text-xs outline-none text-ink"
            />
            <button
              onClick={handleSubmitComment}
              disabled={posting || !draft.trim()}
              className="bg-aurora text-white border-none rounded-full px-3.5 py-2 text-xs font-medium disabled:opacity-60"
            >
              {posting ? "…" : "Send"}
            </button>
          </div>
        </div>
      )}
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

function CommentReactions({
  comment,
  onReact,
}: {
  comment: PostWithMeta["comments"][number];
  onReact: (commentId: string, emoji: ReactionEmoji) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = Object.values(comment.reaction_counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="flex items-center gap-1.5 mt-1.5 relative">
      {REACTION_EMOJIS.filter((e) => (comment.reaction_counts[e] ?? 0) > 0).map((e) => (
        <span
          key={e}
          className={`text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
            comment.my_reaction === e ? "bg-aurora-soft" : "bg-surface"
          }`}
        >
          {e} {comment.reaction_counts[e]}
        </span>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[10px] text-muted bg-transparent border-none"
      >
        {total === 0 ? "react" : "+"}
      </button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 glass bg-surface2 border border-hairline rounded-full px-1.5 py-1 flex gap-1 z-10 pop-in">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(comment.id, e);
                setOpen(false);
              }}
              className="text-sm leading-none bg-transparent border-none hover:scale-125 transition-transform"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
