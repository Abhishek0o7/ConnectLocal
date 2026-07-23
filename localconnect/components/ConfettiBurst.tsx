"use client";

import { useEffect, useState } from "react";

const COLORS = ["#7C5CFC", "#E84393", "#FF7A59", "#33E6A0", "#FFC24B"];

type Piece = { id: number; tx: number; ty: number; rot: number; color: string; size: number; delay: number };

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 90;
    return {
      id: i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance - 30,
      rot: Math.random() * 360 - 180,
      color: COLORS[i % COLORS.length],
      size: 5 + Math.random() * 5,
      delay: Math.random() * 80,
    };
  });
}

/** Fires a one-shot confetti burst whenever `trigger` changes to a new truthy value. */
export default function ConfettiBurst({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[] | null>(null);

  useEffect(() => {
    if (!trigger) return;
    setPieces(makePieces(22));
    const t = setTimeout(() => setPieces(null), 850);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!pieces) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <div className="relative w-0 h-0">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="confetti-piece"
            style={
              {
                width: p.size,
                height: p.size * 0.5,
                background: p.color,
                left: 0,
                top: 0,
                animationDelay: `${p.delay}ms`,
                "--tx": `${p.tx}px`,
                "--ty": `${p.ty}px`,
                "--rot": `${p.rot}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
