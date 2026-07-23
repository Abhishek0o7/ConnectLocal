"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TargetType = "profile" | "post" | "message" | "event";
type Reason = "spam" | "harassment" | "inappropriate" | "fake_profile" | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "other", label: "Something else" },
];

export default function ReportBlockModal({
  open,
  onClose,
  targetType,
  targetId,
  personId,
  personName,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  targetType: TargetType;
  targetId: string;
  personId: string;
  personName: string;
  onBlocked?: () => void;
}) {
  const supabase = createClient();
  const [mode, setMode] = useState<"menu" | "report" | "confirmBlock">("menu");
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"reported" | "blocked" | null>(null);

  if (!open) return null;

  async function handleSubmitReport() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason,
        details,
      });
    }
    setSubmitting(false);
    setDone("reported");
  }

  async function handleBlock() {
    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: personId });
    }
    setSubmitting(false);
    setDone("blocked");
    onBlocked?.();
  }

  function handleClose() {
    setMode("menu");
    setDone(null);
    setDetails("");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-end sm:items-center justify-center" onClick={handleClose}>
      <div
        className="glass bg-surface border border-hairline rounded-t-2xl sm:rounded-card w-full sm:w-[380px] p-4 pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {done === "reported" && (
          <p className="text-sm text-ink py-4 text-center">
            Thanks — we've received your report and will take a look.
          </p>
        )}
        {done === "blocked" && (
          <p className="text-sm text-ink py-4 text-center">
            {personName} is blocked. You won't see each other anymore.
          </p>
        )}

        {!done && mode === "menu" && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted mb-2 px-1">{personName}</p>
            <button
              onClick={() => setMode("report")}
              className="text-left text-sm text-ink bg-surface2 border-none rounded-xl px-3.5 py-3"
            >
              Report {targetType === "profile" ? "this profile" : targetType}
            </button>
            <button
              onClick={() => setMode("confirmBlock")}
              className="text-left text-sm text-red bg-red-light border-none rounded-xl px-3.5 py-3"
            >
              Block {personName}
            </button>
            <button onClick={handleClose} className="text-center text-sm text-muted bg-transparent border-none py-3">
              Cancel
            </button>
          </div>
        )}

        {!done && mode === "report" && (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium text-muted">Why are you reporting this?</p>
            {REASONS.map((r) => (
              <label key={r.value} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="accent-primary"
                />
                {r.label}
              </label>
            ))}
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add details (optional)"
              className="bg-surface2 border-none rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none h-16 text-ink"
            />
            <button
              onClick={handleSubmitReport}
              disabled={submitting}
              className="bg-aurora text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
            <button onClick={() => setMode("menu")} className="text-center text-xs text-muted bg-transparent border-none">
              Back
            </button>
          </div>
        )}

        {!done && mode === "confirmBlock" && (
          <div className="flex flex-col gap-2.5">
            <p className="text-sm text-ink">
              Block {personName}? You won't see each other in discovery, feed, or chat anymore. This can be undone later.
            </p>
            <button
              onClick={handleBlock}
              disabled={submitting}
              className="bg-red text-white border-none rounded-full py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Blocking…" : "Yes, block"}
            </button>
            <button onClick={() => setMode("menu")} className="text-center text-xs text-muted bg-transparent border-none">
              Back
            </button>
          </div>
        )}

        {done && (
          <button onClick={handleClose} className="w-full text-center text-sm text-gradient font-semibold py-2 mt-1">
            Done
          </button>
        )}
      </div>
    </div>
  );
}
