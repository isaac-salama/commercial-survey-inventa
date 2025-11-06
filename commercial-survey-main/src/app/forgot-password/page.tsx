"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { requestReset } from "./actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await requestReset({ email });
      if (!res.ok) { setError(res.message || "Erro ao enviar"); return; }
      setSent(true);
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#3135ef] text-white">
      <div className="w-full max-w-sm">
        {sent ? (
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">Verifique seu e-mail</h1>
            <p>Se o e-mail existir, você receberá um link para redefinir sua senha.</p>
            <Link className="underline" href="/">Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-xl font-semibold">Esqueci minha senha</h1>
            <label className="block text-sm">
              <span>E-mail</span>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mt-1 w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70" />
            </label>
            {error && <p className="text-sm text-red-200">{error}</p>}
            <div className="flex items-center justify-between">
              <Link href="/" className="underline text-sm">Voltar</Link>
              <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2 text-[#2A2AE6] font-semibold">
                {loading ? "Enviando…" : "Enviar link"}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
