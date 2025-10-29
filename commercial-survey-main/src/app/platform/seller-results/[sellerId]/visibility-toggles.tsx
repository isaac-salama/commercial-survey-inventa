"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeCardVisibility } from "@/app/platform/actions";

type Props = {
  sellerId: number;
  showIndex: boolean;
  showAssessment: boolean;
};

export default function VisibilityToggles({ sellerId, showIndex, showAssessment }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const btn = (
    active: boolean,
    onClick: () => void,
    labelOn: string,
    labelOff: string
  ) => (
    <button
      type="button"
      onClick={() => start(onClick)}
      disabled={pending}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${
        active ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb] bg-white text-[#111827]"
      }`}
    >
      {active ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.29 20.29 0 0 1 5.06-5.94"/>
          <path d="M1 1l22 22"/>
        </svg>
      )}
      <span className="whitespace-nowrap">{active ? labelOn : labelOff}</span>
    </button>
  );

  return (
    <div className="flex items-center gap-2">
      {btn(showIndex, async () => {
        await setHomeCardVisibility({ sellerId, card: 1, visible: !showIndex });
        router.refresh();
      }, "Index visível", "Index oculto")}
      {btn(showAssessment, async () => {
        await setHomeCardVisibility({ sellerId, card: 2, visible: !showAssessment });
        router.refresh();
      }, "Assessment visível", "Assessment oculto")}
    </div>
  );
}

