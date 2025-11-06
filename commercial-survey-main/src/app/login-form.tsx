"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/primary-button";
import Link from "next/link";
// no image import; inline SVG wordmark is used
import InventaLogoWord from "@/components/inventa-logo-word";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avoid leaking full email/PII in logs
  function maskEmail(e: string) {
    const [name, domain] = e.split("@");
    if (!domain) return "(invalid)";
    if (!name) return `*@${domain}`;
    const shown = name.slice(0, 2);
    return `${shown}${"*".repeat(Math.max(0, name.length - shown.length))}@${domain}`;
  }

  function summarizeSession(session: Session | null) {
    if (!session) return { present: false };
    const user = session.user || {};
    return {
      present: true,
      user: {
        email: typeof user.email === "string" ? maskEmail(user.email) : undefined,
        role: user.role ?? null,
      },
      expires: session.expires ?? null,
    };
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      console.info("[AUTH] Submitting credentials", {
        email: maskEmail(email),
        redirect: false,
      });

      const preSession = await getSession();
      console.info("[AUTH] Session before signIn", summarizeSession(preSession));

      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.info("[AUTH] signIn response", {
        ok: res?.ok ?? null,
        status: res?.status ?? null,
        error: res?.error ?? null,
        url: res?.url ?? null,
      });

      const postSession = await getSession();
      console.info("[AUTH] Session after signIn", summarizeSession(postSession));

      if (res?.error) {
        console.error("[AUTH] Sign-in failed with error", res.error);
        setError("Email ou senha inválidos");
        setLoading(false);
        return;
      }

      if (!postSession) {
        console.warn(
          "[AUTH] signIn returned no error but session is null. This may indicate a server/session configuration issue (e.g., NEXTAUTH_SECRET, cookie, or domain settings)."
        );
      }

      // Refresh to server component; server will redirect by role
      console.info("[AUTH] Navigating to root after sign-in");
      router.replace("/");
    } catch (err) {
      console.error("[AUTH] Unexpected error during sign-in", err);
      setError("Algo deu errado. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="mx-auto mb-6 flex items-center justify-center">
        <InventaLogoWord width={133} height={40} />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-semibold text-white mb-6">
          <span>Transforme sua operação de e-commerce </span>
          <span className="text-[#B8F4F7]">em vantagem competitiva</span>
        </h1>
      </div>
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-white">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-medium text-white">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded border border-white/80 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/70"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end">
        <div className="flex items-center justify-between w-full">
          <Link href="/forgot-password" className="underline text-sm">Esqueci a senha</Link>
          <div className="flex items-center gap-2">
            <Link href="/signup" className="underline text-sm">Criar conta</Link>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </form>
  );
}
