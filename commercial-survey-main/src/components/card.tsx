import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cx(
        "rounded-xl border border-white/20 bg-white text-[#171717] shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

