"use client";

import Image from "next/image";
import React from "react";

type UnlockLoaderProps = {
  size?: number; // outer ring diameter in px
  label?: string; // a11y label
  on?: "light" | "dark"; // background context where the loader sits
};

// Branded loader with Unlock logo centered over an animated ring and soft glow.
// Designed to keep the white logo visible regardless of surrounding UI by
// providing its own contrasting disc background when used on light surfaces.
export function UnlockLoader({ size = 128, label = "Carregando perguntas…", on = "light" }: UnlockLoaderProps) {
  const ringSize = size; // outer spinner diameter
  const discSize = Math.round(size * 0.74); // inner contrast disc
  const logoSize = Math.round(size * 0.42); // logo size

  // When used on a light surface (e.g., white card), we draw a dark disc to
  // guarantee contrast for the white logo. On dark surfaces, use a softer disc.
  const discColor = on === "light" ? "#1f1140" : "#2b2370";
  const ringBase = on === "light" ? "#e5e7eb" : "#4b4b8e"; // neutral ring color
  const ringTop = "#3135ef"; // brand accent

  return (
    <div className="flex w-full items-center justify-center py-8" role="status" aria-live="polite" aria-label={label}>
      <div className="relative" style={{ width: ringSize, height: ringSize }}>
        {/* Soft brand glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full blur-2xl animate-pulse"
          style={{
            background: "rgba(49, 53, 239, 0.16)",
            filter: "drop-shadow(0 4px 24px rgba(49,53,239,0.28))",
          }}
        />

        {/* Contrast disc to keep white logo visible */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full shadow"
          style={{
            width: discSize,
            height: discSize,
            background: discColor,
            boxShadow: "0 0 30px rgba(49,53,239,0.35) inset, 0 6px 18px rgba(0,0,0,0.25)",
          }}
        />

        {/* Animated ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxSizing: "border-box",
            borderWidth: 4,
            borderStyle: "solid",
            borderColor: ringBase,
            borderTopColor: ringTop,
            animation: "spin 1.1s linear infinite",
          }}
        />

        {/* Unlock logo */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/unlock-minal-logo-branco.svg"
            alt="Unlock"
            width={logoSize}
            height={Math.round(logoSize * 0.58)}
            priority={false}
          />
        </div>
      </div>

      {/* Screen reader fallback text */}
      <span className="sr-only">{label}</span>

      {/* Inline keyframes for spin (keeps things self-contained) */}
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

