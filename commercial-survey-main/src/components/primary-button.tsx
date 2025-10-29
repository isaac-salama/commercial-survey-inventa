"use client";

import React from "react";

type PrimaryButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  fullWidth?: boolean;
  innerClassName?: string;
};

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function PrimaryButton({
  children,
  className,
  innerClassName,
  disabled,
  fullWidth,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cx(
        "relative inline-flex items-center justify-center focus:outline-none disabled:opacity-50 group hover:cursor-pointer",
        fullWidth && "w-full",
        className
      )}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center rounded-xl bg-[#B8F4F7] px-5 py-2 text-base text-[#2A2AE6] transition-colors",
          fullWidth && "w-full",
          innerClassName
        )}
      >
        {children}
      </span>
    </button>
  );
}
