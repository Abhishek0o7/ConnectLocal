"use client";

import { useRef, useState } from "react";
import type { Profile } from "@/lib/types/db";

export default function ShareProfileCard({ profile }: { profile: Profile }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState<string | null>(null);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 900;
    const H = 1200;
    canvas.width = W;
    canvas.height = H;

    // Background — near-black with the aurora radial glow, matching the app
    ctx.fillStyle = "#0B0A14";
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.2, H * 0.05, 0, W * 0.2, H * 0.05, 700);
    glow.addColorStop(0, "rgba(124,92,252,0.35)");
    glow.addColorStop(1, "rgba(124,92,252,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    const glow2 = ctx.createRadialGradient(W * 0.9, H * 0.15, 0, W * 0.9, H * 0.15, 600);
    glow2.addColorStop(0, "rgba(232,67,147,0.28)");
    glow2.addColorStop(1, "rgba(232,67,147,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, W, H);

    // Aurora ring behind avatar
    const cx = W / 2;
    const cy = 340;
    const r = 130;
    const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ringGrad.addColorStop(0, "#7C5CFC");
    ringGrad.addColorStop(0.55, "#E84393");
    ringGrad.addColorStop(1, "#FF7A59");
    ctx.beginPath();
    ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // Avatar circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = profile.avatar_bg || "#7C5CFC";
    ctx.fill();
    ctx.fillStyle = profile.avatar_fg || "#ffffff";
    ctx.font = "700 90px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(profile.initials, cx, cy + 8);

    // Name
    ctx.fillStyle = "#F5F3FF";
    ctx.font = "700 56px Arial";
    ctx.fillText(profile.name, cx, cy + 220);

    // Area
    ctx.fillStyle = "#9B96B8";
    ctx.font = "400 32px Arial";
    ctx.fillText(profile.area || "", cx, cy + 270);

    // Mood pill
    if (profile.mood_emoji && profile.mood_text) {
      const label = `${profile.mood_emoji}  ${profile.mood_text}`;
      ctx.font = "600 34px Arial";
      const textWidth = ctx.measureText(label).width;
      const padX = 40;
      const pillW = textWidth + padX * 2;
      const pillH = 76;
      const pillX = cx - pillW / 2;
      const pillY = cy + 320;
      const pillGrad = ctx.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH);
      pillGrad.addColorStop(0, "rgba(124,92,252,0.25)");
      pillGrad.addColorStop(1, "rgba(255,122,89,0.25)");
      ctx.fillStyle = pillGrad;
      roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = "#F5F3FF";
      ctx.fillText(label, cx, pillY + pillH / 2 + 2);
    }

    // Interests chips
    const chipsY = H - 260;
    let chipX = 80;
    ctx.font = "500 28px Arial";
    (profile.interests || []).slice(0, 4).forEach((tag) => {
      const w = ctx.measureText(tag).width + 56;
      if (chipX + w > W - 80) return;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, chipX, chipsY, w, 60, 30);
      ctx.fill();
      ctx.fillStyle = "#9B96B8";
      ctx.textAlign = "left";
      ctx.fillText(tag, chipX + 28, chipsY + 38);
      chipX += w + 16;
    });

    // Footer brand
    ctx.textAlign = "center";
    ctx.font = "700 34px Arial";
    ctx.fillStyle = "#F5F3FF";
    ctx.fillText("LocalConnect", cx, H - 100);
    ctx.font = "400 24px Arial";
    ctx.fillStyle = "#9B96B8";
    ctx.fillText("find your people nearby", cx, H - 60);

    setReady(canvas.toDataURL("image/png"));
  }

  function download() {
    if (!ready) return;
    const a = document.createElement("a");
    a.href = ready;
    a.download = "my-localconnect-card.png";
    a.click();
  }

  return (
    <div>
      <button
        onClick={draw}
        className="w-full bg-primary-light text-primary-dark border-none rounded-full py-2.5 text-sm font-medium"
      >
        📸 Create shareable profile card
      </button>
      <canvas ref={canvasRef} className="hidden" />
      {ready && (
        <div className="mt-3 flex flex-col items-center gap-2.5 pop-in">
          <img src={ready} alt="Shareable profile card" className="w-full max-w-[280px] rounded-card" />
          <button
            onClick={download}
            className="bg-aurora text-white border-none rounded-full px-5 py-2 text-xs font-medium"
          >
            Download image
          </button>
        </div>
      )}
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
