"use server";

import { withPlatformDb } from "@/db/client";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { sendEmail } from "@/server/email";

type Result = { ok: true } | { ok: false; message: string };

export async function requestReset(input: { email: string }): Promise<Result> {
  const email = (input.email || "").trim().toLowerCase();
  if (!email) return { ok: false, message: "Informe o e-mail" };
  const exists = await withPlatformDb((db) => db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, email)).limit(1));
  if (!exists[0]) return { ok: true }; // do not reveal
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min
  await withPlatformDb((db) => db.insert(passwordResetTokens).values({ email, tokenHash, expiresAt }));
  const base = process.env.NEXTAUTH_URL || "";
  const url = `${base || ""}/reset-password?token=${encodeURIComponent(token)}`;
  const html = `<p>Use o link para redefinir sua senha:</p><p><a href="${url}">${url}</a></p><p>O link expira em 30 minutos.</p>`;
  await sendEmail({ to: email, subject: "Redefinir senha", html });
  return { ok: true };
}

export async function resetPassword(input: { token: string; password: string }): Promise<Result> {
  const token = (input.token || "").trim();
  const password = input.password || "";
  if (!token || password.length < 8) return { ok: false, message: "Dados inválidos" };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  type ResetRow = { id: number; email: string; expiresAt: Date; usedAt: Date | null };
  const rows: ResetRow[] = await withPlatformDb((db) =>
    db
      .select({ id: passwordResetTokens.id, email: passwordResetTokens.email, expiresAt: passwordResetTokens.expiresAt, usedAt: passwordResetTokens.usedAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1)
  );
  const row = rows[0];
  if (!row || row.usedAt || row.expiresAt < now) {
    return { ok: false, message: "Token inválido ou expirado" };
  }
  const { hash } = await import("bcryptjs");
  const pwHash = await hash(password, 10);
  await withPlatformDb(async (db) => {
    await db.update(users).set({ passwordHash: pwHash, updatedAt: now }).where(eq(sql`lower(${users.email})`, row.email.toLowerCase()));
    await db.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, row.id));
  });
  return { ok: true };
}
