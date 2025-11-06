"use server";

import { withPlatformDb } from "@/db/client";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { rateLimit } from "@/server/rate-limit";
import { verifyTurnstile } from "@/server/turnstile";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; message: string };

export async function createSeller(input: { email: string; password: string; name?: string | null; turnstile?: string }): Promise<Result> {
  const rawEmail = (input.email || "").trim();
  const password = input.password || "";
  const name = (input.name || "").trim() || null;
  if (!rawEmail || !password || password.length < 8) return { ok: false, message: "Dados inválidos" };

  // Rate limit by email and ip bucket
  const rlA = await rateLimit(`signup:${rawEmail.toLowerCase()}`, 5, 3600);
  if (!rlA.allowed) return { ok: false, message: "Muitas tentativas. Tente mais tarde." };

  const turnstileOk = await verifyTurnstile(input.turnstile);
  if (!turnstileOk) return { ok: false, message: "Validação de segurança falhou" };

  const email = rawEmail.toLowerCase();

  // Basic disposable domain check (lightweight)
  const domain = email.split("@")[1] || "";
  const disposable = ["mailinator.com", "guerrillamail.com", "trashmail.com", "tempmail.com", "yopmail.com"];
  if (disposable.some((d) => domain.endsWith(d))) {
    return { ok: false, message: "Use um e-mail válido" };
  }

  // Create if not exists (case-insensitive)
  const pwHash = await hash(password, 10);
  try {
    const exists = await withPlatformDb((db) =>
      db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email)).limit(1)
    );
    if (exists[0]) return { ok: false, message: "E-mail já cadastrado" };

    await withPlatformDb((db) =>
      db
        .insert(users)
        .values({ email, name, passwordHash: pwHash, role: "seller", showIndex: true, showAssessment: true })
    );
    return { ok: true };
  } catch {
    return { ok: false, message: "Não foi possível criar a conta" };
  }
}
