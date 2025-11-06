"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { resetPassword } from "../forgot-password/actions";

export default function ResetPasswordPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [loading, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) { setError("Token inválido"); return; }
    if (password.length < 8) { setError("Senha deve ter pelo menos 8 caracteres"); return; }
    start(async () => {
      const res = await resetPassword({ token, password });
      if (!res.ok) { setError(res.message || "Erro ao redefinir senha"); return; }
      setOk(true);
      setTimeout(() => router.replace("/"), 1200);
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#3135ef] text-white">
      <div className="w-full max-w-sm">
        {ok ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">Senha alterada</h1>
            <p>Redirecionando para o login…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-xl font-semibold">Definir nova senha</h1>
            <label className="block text-sm">
              <span>Nova senha</span>
              <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70" />
            </label>
            {error && <p className="text-sm text-red-200">{error}</p>}
            <div className="flex items-center justify-between">
              <Link href="/" className="underline text-sm">Cancelar</Link>
              <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2 text-[#2A2AE6] font-semibold">
                {loading ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
