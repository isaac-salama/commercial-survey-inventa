"use client";

import React, { useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import styles from "./unlock-cta-card.module.css";

type Props = {
  onClick?: () => void;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  imageSrc?: string;
  variant?: "default" | "alt";
  href?: string;
};

export default function UnlockCtaCard({
  onClick,
  title = "Descubra seu Unlock Index",
  subtitle = "Entenda a maturidade do seu e-commerce e transforme em vantagem competitiva.",
  ctaText = "Calcular agora",
  imageSrc = "/card-1.png",
  variant = "default",
  href,
}: Props) {
  const router = useRouter();

  const handleCta = useCallback(() => {
    if (onClick) return onClick();
    // Default: navigate to /seller/index
    router.push(href ?? "/seller/index");
  }, [onClick, router, href]);

  const rootRef = useRef<HTMLDivElement | null>(null);

  return (
    <div
      ref={rootRef}
      className={`${styles.cardRoot} ${variant === "alt" ? styles.cardRootAlt : ""} grid w-full md:grid-cols-[auto_1fr] items-stretch gap-4 md:gap-6 p-6 md:p-8 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
      aria-label="Unlock Index CTA"
      role="button"
      tabIndex={0}
      onClick={handleCta}
      onPointerDown={() => rootRef.current?.setAttribute("data-active", "true")}
      onPointerUp={() => rootRef.current?.removeAttribute("data-active")}
      onPointerCancel={() => rootRef.current?.removeAttribute("data-active")}
      onBlur={() => rootRef.current?.removeAttribute("data-active")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rootRef.current?.setAttribute("data-active", "true");
        }
      }}
      onKeyUp={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          rootRef.current?.removeAttribute("data-active");
          handleCta();
        }
      }}
    >
      {/* Left: decorative image (hidden on mobile). Max height 300px, aspect 16:9, centered crop */}
      <div className="relative hidden md:flex items-center justify-start">
        <div className={styles.imageBox}>
          <Image
            src={imageSrc}
            alt=""
            fill
            className="object-cover object-center"
            sizes="(min-width: 768px) 50vw, 100vw"
            priority={false}
          />
        </div>
      </div>

      {/* Right: content */}
      <div className="flex flex-col md:h-[130px] md:max-h-[130px] justify-center text-white/95 overflow-hidden">
        <div className="flex items-center gap-6 justify-between">
          <div className="min-w-0">
            <h2 className={`${styles.titleClamp} text-xl md:text-2xl font-extrabold leading-tight`}>
              {title}
            </h2>
            <p className={`${styles.subtitleClamp} mt-2 text-sm md:text-base text-white/90`}>
              {subtitle}
            </p>
          </div>
          {/* Visual CTA chip anchored to the right */}
          <span className={`shrink-0 inline-flex items-center justify-center rounded-xl bg-white px-5 py-2 text-[#2A2AE6] font-semibold select-none`}>
            {ctaText}
          </span>
        </div>
      </div>
    </div>
  );
}
