"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSeller } from "./actions";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/seller/index";
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    if (!siteKey) return;
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    document.body.appendChild(s);
    return () => { document.body.removeChild(s); };
  }, [siteKey]);

  type Turnstile = { render: (selector: string, opts: { sitekey: string; callback: (tk: string) => void }) => unknown; remove: (w: unknown) => void };

  useEffect(() => {
    if (!siteKey) return;
    const ts = (typeof window !== "undefined" ? (window as unknown as { turnstile?: Turnstile }).turnstile : undefined);
    if (!ts || !document) return;
    const el = document.getElementById("cf-turnstile-slot");
    if (!el) return;
    const wid = ts.render("#cf-turnstile-slot", { sitekey: siteKey, callback: (tk: string) => setTurnstileToken(tk) });
    return () => { try { ts.remove(wid); } catch {} };
  }, [siteKey]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!consent) { setError("Você precisa aceitar os termos"); return; }
    if (password.length < 8) { setError("Senha deve ter pelo menos 8 caracteres"); return; }
    start(async () => {
      const res = await createSeller({ email, password, name, turnstile: turnstileToken });
      if (!res.ok) { setError(res.message || "Não foi possível criar a conta"); return; }
      const out = await signIn("credentials", { email, password, redirect: false, callbackUrl: next });
      if (out?.error) { setError("Erro ao entrar. Tente fazer login."); return; }
      router.replace(next);
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#3135ef] text-white">
      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <h1 className="text-xl font-semibold">Criar conta</h1>
          <label className="block text-sm">
            <span>E-mail</span>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" required className="mt-1 w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70" />
          </label>
          <label className="block text-sm">
            <span>Nome (opcional)</span>
            <input value={name} onChange={e=>setName(e.target.value)} type="text" className="mt-1 w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70" />
          </label>
          <label className="block text-sm">
            <span>Senha</span>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70" />
          </label>
          {siteKey ? (
            <div id="cf-turnstile-slot" className="my-2" />
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} />
            <span>Concordo com os termos de uso</span>
          </label>
          {error && <p className="text-sm text-red-200">{error}</p>}
          <div className="flex items-center justify-between">
            <Link href="/" className="underline text-sm">Já tenho conta</Link>
            <button type="submit" disabled={loading} className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-2 text-[#2A2AE6] font-semibold">
              {loading ? "Criando…" : "Criar conta"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
