"use client";

export default function Avatar({
  url,
  initials,
  bg,
  fg,
  size = 44,
  ring = false,
  className = "",
}: {
  url?: string | null;
  initials: string;
  bg: string;
  fg: string;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const core = url ? (
    <img
      src={url}
      alt={initials}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-semibold font-display"
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );

  if (!ring) return <div className={className}>{core}</div>;
  return <div className={`aurora-ring inline-block ${className}`}>{core}</div>;
}
