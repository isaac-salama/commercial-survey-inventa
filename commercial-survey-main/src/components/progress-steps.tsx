"use client";

import React from "react";

type ProgressStepsProps = {
  steps: string[];
  currentIndex: number; // 0-based
  onStepClick?: (index: number) => void;
  className?: string;
  variant?: "default" | "minimal";
  labelPosition?: "right" | "below"; // layout of label relative to number
};

const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export function ProgressSteps({
  steps,
  currentIndex,
  onStepClick,
  className,
  variant = "default",
  labelPosition = "right",
}: ProgressStepsProps) {
  const isStacked = labelPosition === "below";
  return (
    <ol
      role="list"
      className={cx(
        "w-full flex items-center gap-2 md:gap-3",
        className
      )}
      aria-label="Progress"
    >
      {steps.map((label, i) => {
        const isCompleted = i < currentIndex;
        const isActive = i === currentIndex;
        const isLast = i === steps.length - 1;
        const circle = (
          <span
            className={cx(
              "flex h-8 w-8 items-center justify-center rounded-full border text-sm",
              variant === "minimal"
                ? isActive
                  ? "bg-white text-[#3135ef] border-white"
                  : "border-white/60 text-white/80"
                : undefined,
              variant === "default" && isCompleted &&
                "bg-white text-[#3135ef] border-white",
              variant === "default" && isActive &&
                "bg-white text-[#3135ef] border-white",
              variant === "default" && !isCompleted && !isActive &&
                "border-white/60 text-white/80",
              variant === "minimal" ? "font-bold" : "font-medium"
            )}
            aria-current={isActive ? "step" : undefined}
            aria-label={
              variant === "minimal"
                ? `${isActive ? "Passo atual: " : "Próximo passo: "}${label}`
                : `${isActive ? "Passo atual: " : isCompleted ? "Passo concluído: " : "Próximo passo: "}${label}`
            }
          >
            {variant === "minimal" ? i + 1 : isCompleted ? "✓" : i + 1}
          </span>
        );

        const content = (
          <div
            className={cx(
              isStacked ? "flex flex-col items-center gap-1" : "flex items-center gap-2"
            )}
          >
            {circle}
            <span
              className={cx(
                isStacked ? "block text-[10px] sm:text-xs md:text-sm leading-tight text-center" : "hidden sm:block text-xs md:text-sm",
                variant === "minimal"
                  ? isActive
                    ? "text-white"
                    : "text-white/80"
                  : isActive || isCompleted
                  ? "text-white"
                  : "text-white/80",
                variant === "minimal" && "font-bold"
              )}
            >
              {label}
            </span>
          </div>
        );

        return (
          <li
            key={i}
            className={cx(
              "flex items-center gap-2 md:gap-3",
              !isLast && "flex-1"
            )}
          >
            {onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(i)}
                className="inline-flex items-center gap-2 focus:outline-none"
                aria-label={`Ir para o passo ${i + 1}: ${label}`}
              >
                {content}
              </button>
            ) : (
              content
            )}
            {!isLast && (
              <span
                className={cx(
                  "block h-[2px] w-6 md:w-10",
                  // When stacked or we want even spacing, stretch connector
                  (isStacked || variant === "minimal") && "w-full flex-1",
                  variant === "minimal"
                    ? "bg-white/40"
                    : isCompleted
                    ? "bg-white"
                    : "bg-white/40"
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
