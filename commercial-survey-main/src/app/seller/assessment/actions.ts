"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { withSellerDb } from "@/db/client";
import { sellerAssessments, type SellerAssessmentData } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; code: string; message: string };

async function getSellerId(): Promise<Result<number>> {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return { ok: false, code: "UNAUTHORIZED", message: "Not authenticated" };
  }
  if (session.user.role !== "seller") {
    return { ok: false, code: "FORBIDDEN", message: "Only sellers can perform this action" };
  }
  const sellerId = Number(session.user.id);
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return { ok: false, code: "NOT_FOUND", message: "Seller not found" };
  }
  return { ok: true, data: sellerId };
}

export type GetAssessmentOutput = {
  status: "draft" | "submitted";
  data: SellerAssessmentData;
  submittedAt: Date | null;
  updatedAt: Date | null;
};

export async function getAssessment(): Promise<Result<GetAssessmentOutput | null>> {
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes as Result<GetAssessmentOutput | null>;
  const sellerId = sellerIdRes.data!;

  const row = await withSellerDb(sellerId, async (db) => {
    const r = await db
      .select({ status: sellerAssessments.status, data: sellerAssessments.data, submittedAt: sellerAssessments.submittedAt, updatedAt: sellerAssessments.updatedAt })
      .from(sellerAssessments)
      .where(eq(sellerAssessments.sellerId, sellerId))
      .limit(1);
    return r[0] ?? null;
  });

  if (!row) return { ok: true, data: null };
  return { ok: true, data: { status: row.status, data: row.data, submittedAt: row.submittedAt ?? null, updatedAt: row.updatedAt ?? null } };
}

export type SaveAssessmentDraftInput = { data: SellerAssessmentData };

export async function saveAssessmentDraft(input: SaveAssessmentDraftInput): Promise<Result> {
  if (!input || typeof input !== "object" || !input.data || typeof input.data !== "object") {
    return { ok: false, code: "INVALID_INPUT", message: "data is required" };
  }
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes;
  const sellerId = sellerIdRes.data!;

  const now = new Date();
  // Prevent edits if already submitted
  const alreadySubmitted = await withSellerDb(sellerId, async (db) => {
    const r = await db
      .select({ status: sellerAssessments.status })
      .from(sellerAssessments)
      .where(eq(sellerAssessments.sellerId, sellerId))
      .limit(1);
    return r[0]?.status === "submitted";
  });
  if (alreadySubmitted) return { ok: false, code: "ALREADY_SUBMITTED", message: "Assessment já enviado e não pode ser alterado." };

  await withSellerDb(sellerId, async (db) => {
    await db
      .insert(sellerAssessments)
      .values({ sellerId, status: "draft", data: input.data, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: sellerAssessments.sellerId,
        set: { status: "draft", data: sql`excluded.data`, updatedAt: now },
      });
  });

  return { ok: true };
}

export type SubmitAssessmentInput = { data: SellerAssessmentData };

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function validateRequiredFields(data: SellerAssessmentData): string | null {
  // 1. solution
  if (!data.solution || !["unlock_full_service", "unlock_response", "unlock_fulfillment"].includes(data.solution)) {
    return "Selecione uma solução";
  }
  // 2. vendaPorRegiao (5 campos)
  const v = data.vendaPorRegiao || {};
  const regions: (keyof NonNullable<typeof data.vendaPorRegiao>)[] = ["sul", "sudeste", "norte", "nordeste", "centroOeste"];
  for (const r of regions) {
    if (!isFiniteNumber(v[r] ?? undefined) || (v[r] as number) < 0) return `Preencha venda para a região: ${r}`;
  }
  // 3. modeloFiscal: ao menos um marcado
  const mf = data.modeloFiscal || {};
  if (!mf.compraEVenda && !mf.filial && !mf.remessaArmazemGeral) return "Selecione pelo menos um modelo fiscal";
  // 4..16 números e textos obrigatórios
  if (!isFiniteNumber(data.volumeMensalPedidos) || (data.volumeMensalPedidos as number) < 0) return "Informe o volume mensal de pedidos";
  if (!isFiniteNumber(data.itensPorPedido) || (data.itensPorPedido as number) <= 0) return "Informe o número médio de itens por pedido";
  if (!isFiniteNumber(data.skus) || (data.skus as number) < 0) return "Informe a quantidade de SKUs";
  if (!isFiniteNumber(data.ticketMedio) || (data.ticketMedio as number) < 0) return "Informe o ticket médio";
  if (!data.canais || !String(data.canais).trim()) return "Informe os canais de vendas";
  if (!isFiniteNumber(data.gmvFlagshipMensal) || (data.gmvFlagshipMensal as number) < 0) return "Informe o GMV Flagship mensal";
  if (!isFiniteNumber(data.gmvMarketplacesMensal) || (data.gmvMarketplacesMensal as number) < 0) return "Informe o GMV Marketplaces mensal";
  if (!isFiniteNumber(data.mesesCoberturaEstoque) || (data.mesesCoberturaEstoque as number) < 0) return "Informe os meses de cobertura de estoque";
  if (!data.perfilProduto || !String(data.perfilProduto).trim()) return "Descreva o perfil de produto";
  if (!isFiniteNumber(data.pesoMedioKg) || (data.pesoMedioKg as number) < 0) return "Informe o peso médio (kg)";
  const d = data.dimensoesCm || {};
  if (!isFiniteNumber(d.c) || (d.c as number) < 0 || !isFiniteNumber(d.l) || (d.l as number) < 0 || !isFiniteNumber(d.a) || (d.a as number) < 0) {
    return "Informe dimensões C, L, A (cm)";
  }
  if (!isFiniteNumber(data.reversaPercent) || (data.reversaPercent as number) < 0 || (data.reversaPercent as number) > 100) {
    return "Informe % de logística reversa (0–100)";
  }
  if (!data.projetosEspeciais || !String(data.projetosEspeciais).trim()) return "Descreva projetos especiais";
  // 17. comentarios opcional
  return null;
}

export async function submitAssessment(input: SubmitAssessmentInput): Promise<Result> {
  if (!input || typeof input !== "object" || !input.data || typeof input.data !== "object") {
    return { ok: false, code: "INVALID_INPUT", message: "data is required" };
  }
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes;
  const sellerId = sellerIdRes.data!;

  const validationError = validateRequiredFields(input.data);
  if (validationError) return { ok: false, code: "VALIDATION_ERROR", message: validationError };

  const now = new Date();
  // If already submitted, block modifications
  const alreadySubmitted = await withSellerDb(sellerId, async (db) => {
    const r = await db
      .select({ status: sellerAssessments.status })
      .from(sellerAssessments)
      .where(eq(sellerAssessments.sellerId, sellerId))
      .limit(1);
    return r[0]?.status === "submitted";
  });
  if (alreadySubmitted) return { ok: false, code: "ALREADY_SUBMITTED", message: "Assessment já enviado e não pode ser reenviado." };

  await withSellerDb(sellerId, async (db) => {
    await db
      .insert(sellerAssessments)
      .values({ sellerId, status: "submitted", data: input.data, submittedAt: now, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: sellerAssessments.sellerId,
        set: { status: "submitted", data: sql`excluded.data`, submittedAt: now, updatedAt: now },
      });
  });

  return { ok: true };
}
