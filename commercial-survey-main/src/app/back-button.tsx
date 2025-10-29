"use client";

import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/primary-button";

export default function BackButton() {
  const router = useRouter();
  return (
    <PrimaryButton
      type="button"
      onClick={() => router.push("/seller/home")}
      aria-label="Voltar"
      className="transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]"
    >
      Voltar
    </PrimaryButton>
  );
}
