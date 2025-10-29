"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { PrimaryButton } from "@/components/primary-button";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut({ callbackUrl: "/" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PrimaryButton
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="Sair"
      className="transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]"
    >
      {loading ? "Saindo..." : "Sair"}
    </PrimaryButton>
  );
}
