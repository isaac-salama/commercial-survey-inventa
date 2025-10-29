"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { withPlatformDb } from "@/db/client";
import { sellerProgress, users } from "@/db/schema";
import { eq } from "drizzle-orm";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; code: string; message: string };

async function requirePlatformUser(): Promise<{ userId: number; email: string } | null> {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "platform") return null;
  const email = session.user?.email;
  if (typeof email !== "string") return null;
  const rows = await withPlatformDb((db) =>
    db.select().from(users).where(eq(users.email, email)).limit(1)
  );
  const u = rows[0];
  if (!u) return null;
  return { userId: u.id, email: u.email };
}

export async function setReceivedReturn(input: { sellerId: number; received: boolean }): Promise<Result> {
  if (!input || typeof input.sellerId !== "number" || typeof input.received !== "boolean") {
    return { ok: false, code: "INVALID_INPUT", message: "sellerId and received are required" };
  }
  const actor = await requirePlatformUser();
  if (!actor) return { ok: false, code: "FORBIDDEN", message: "Platform access required" };

  const now = new Date();

  if (input.received) {
    await withPlatformDb((db) =>
      db
        .insert(sellerProgress)
        .values({
          sellerId: input.sellerId,
          receivedReturn: true,
          receivedReturnMarkedAt: now,
          receivedReturnMarkedByUserId: actor.userId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: sellerProgress.sellerId,
          set: {
            receivedReturn: true,
            receivedReturnMarkedAt: now,
            receivedReturnMarkedByUserId: actor.userId,
            updatedAt: now,
          },
        })
    );
  } else {
    // When unsetting, ensure a row exists and clear metadata
    await withPlatformDb((db) =>
      db
        .insert(sellerProgress)
        .values({
          sellerId: input.sellerId,
          receivedReturn: false,
          receivedReturnMarkedAt: null,
          receivedReturnMarkedByUserId: null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: sellerProgress.sellerId,
          set: {
            receivedReturn: false,
            receivedReturnMarkedAt: null,
            receivedReturnMarkedByUserId: null,
            updatedAt: now,
          },
        })
    );
  }

  return { ok: true };
}

export async function setHomeCardVisibility(input: {
  sellerId: number;
  card: 1 | 2;
  visible: boolean;
}): Promise<Result> {
  if (
    !input ||
    typeof input.sellerId !== "number" ||
    (input.card !== 1 && input.card !== 2) ||
    typeof input.visible !== "boolean"
  ) {
    return { ok: false, code: "INVALID_INPUT", message: "sellerId, card and visible are required" };
  }

  const actor = await requirePlatformUser();
  if (!actor) return { ok: false, code: "FORBIDDEN", message: "Platform access required" };

  await withPlatformDb((db) => {
    if (input.card === 1) {
      return db.update(users).set({ showIndex: input.visible }).where(eq(users.id, input.sellerId));
    }
    return db.update(users).set({ showAssessment: input.visible }).where(eq(users.id, input.sellerId));
  });

  return { ok: true };
}
