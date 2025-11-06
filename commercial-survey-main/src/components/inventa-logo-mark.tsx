"use client";

import React from "react";

type Props = {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

// Inventa mark (square), white fill. ViewBox 600x600.
export default function InventaLogoMark({ width = 75, height, className, style, title }: Props) {
  const h = typeof height === "number" ? height : width; // default square
  return (
    <svg
      width={width}
      height={h}
      viewBox="0 0 600 600"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      className={className}
      style={style}
      role="img"
      aria-label={title || "Inventa"}
    >
      {title ? <title>{title}</title> : null}
      <path d="M344.584 131C334.453 144.302 318.416 152.918 300.327 152.918C282.239 152.918 266.202 144.302 256.05 131H204C217.863 170.64 255.701 199.098 300.327 199.098C344.953 199.098 382.791 170.64 396.655 131H344.605H344.584Z" fill="white"/>
      <path d="M331.285 225.254H269.371V469.432H331.285V225.254Z" fill="white"/>
    </svg>
  );
}

