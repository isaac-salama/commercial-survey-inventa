import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import LogoutButton from "../logout-button";
import Image from "next/image";
import { withPlatformDb } from "@/db/client";
import {
  questionResponses,
  sellerProgress,
  stepQuestions,
  surveySteps,
  users,
  sellerAssessments,
  type SellerAssessmentData,
} from "@/db/schema";
import { and, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import SellerTable from "./seller-table";

type SearchParams = {
  q?: string;
  cursor?: string;
  limit?: string;
  // Quick filters
  fIndexDone?: string; // '1' to filter only finished index
  fAssessSent?: string; // '1' only submitted, '0' only not submitted
  fStale30?: string; // '1' last access older than 30d or never
  fIndexVisible?: string; // '1' only visible, '0' only not visible
  fAssessVisible?: string; // '1' only visible, '0' only not visible
};

export default async function PlatformPage({ searchParams }: { searchParams?: SearchParams }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect("/");
  }

  if (role !== "platform") {
    if (role === "seller") redirect("/seller/home");
    redirect("/");
  }

  const q = (searchParams?.q ?? "").trim();
  const limit = 25; // fixed per requirements
  const cursorRaw = searchParams?.cursor;
  const fIndexDone = searchParams?.fIndexDone === "1";
  const fAssessSent = searchParams?.fAssessSent;
  const fStale30 = searchParams?.fStale30 === "1";
  const fIndexVisible = searchParams?.fIndexVisible;
  const fAssessVisible = searchParams?.fAssessVisible;

  function encodeCursor(ts: string, id: number) {
    return Buffer.from(JSON.stringify({ ts, id }), "utf8").toString("base64url");
  }
  function decodeCursor(raw?: string): { ts: string; id: number } | null {
    if (!raw) return null;
    try {
      const obj = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
      if (typeof obj?.ts === "string" && typeof obj?.id === "number") return obj;
      return null;
    } catch {
      return null;
    }
  }

  const cur = decodeCursor(cursorRaw);

  // Active steps and totals
  const stepRows = await withPlatformDb((db) =>
    db
      .select({ id: surveySteps.id, key: surveySteps.key, title: surveySteps.title, order: surveySteps.order })
      .from(surveySteps)
      .where(eq(surveySteps.isActive, true))
      .orderBy(surveySteps.order)
  );
  const stepIds = stepRows.map((s) => s.id);
  const totalsRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ stepId: stepQuestions.stepId, total: sql<number>`count(*)` })
          .from(stepQuestions)
          .where(inArray(stepQuestions.stepId, stepIds))
          .groupBy(stepQuestions.stepId)
      )
    : [];
  const totalByStep = new Map<number, number>(totalsRows.map((r) => [r.stepId, Number(r.total)]));

  // Base filters
  const filters = [eq(users.role, "seller" as const)];
  if (q) filters.push(ilike(users.email, `%${q}%`));

  // Cursor filter: ORDER BY COALESCE(last_login_at, created_at) DESC, id DESC
  const sortExpr = sql`coalesce(${users.lastLoginAt}, ${users.createdAt})`;
  if (cur) {
    filters.push(
      sql`(${sortExpr} < ${cur.ts}::timestamp OR (${sortExpr} = ${cur.ts}::timestamp AND ${users.id} < ${cur.id}))`
    );
  }

  // Apply quick filters
  if (fIndexDone) filters.push(eq(sellerProgress.reachedStep8, true));
  if (fStale30) filters.push(sql`${users.lastLoginAt} IS NULL OR ${users.lastLoginAt} < (now() - interval '30 days')`);
  if (fIndexVisible === "1") filters.push(eq(users.showIndex, true));
  if (fIndexVisible === "0") filters.push(eq(users.showIndex, false));
  if (fAssessVisible === "1") filters.push(eq(users.showAssessment, true));
  if (fAssessVisible === "0") filters.push(eq(users.showAssessment, false));
  if (fAssessSent === "1") filters.push(eq(sellerAssessments.status, "submitted"));
  if (fAssessSent === "0") filters.push(sql`${sellerAssessments.status} IS NULL OR ${sellerAssessments.status} <> 'submitted'`);

  // Fetch sellers page (+1 to detect hasMore)
  const sellerRows = await withPlatformDb((db) =>
    db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
        showIndex: users.showIndex,
        showAssessment: users.showAssessment,
        reachedStep8: sellerProgress.reachedStep8,
        reachedStep8At: sellerProgress.reachedStep8At,
        receivedReturn: sellerProgress.receivedReturn,
        receivedReturnMarkedAt: sellerProgress.receivedReturnMarkedAt,
        receivedReturnMarkedByUserId: sellerProgress.receivedReturnMarkedByUserId,
        assessStatus: sellerAssessments.status,
        assessSubmittedAt: sellerAssessments.submittedAt,
        assessData: sellerAssessments.data,
      })
      .from(users)
      .leftJoin(sellerProgress, eq(sellerProgress.sellerId, users.id))
      .leftJoin(sellerAssessments, eq(sellerAssessments.sellerId, users.id))
      .where(and(...filters))
      .orderBy(desc(sortExpr), desc(users.id))
      .limit(limit + 1)
  );

  const hasMore = sellerRows.length > limit;
  const pageItems = hasMore ? sellerRows.slice(0, limit) : sellerRows;
  const nextCursor = hasMore
    ? encodeCursor((pageItems[pageItems.length - 1].lastLoginAt ?? pageItems[pageItems.length - 1].createdAt)!.toISOString(), pageItems[pageItems.length - 1].id)
    : null;

  const sellerIds = pageItems.map((r) => r.id);

  // Answered counts per seller per step
  const answeredRows = sellerIds.length && stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({
            sellerId: questionResponses.sellerId,
            stepId: stepQuestions.stepId,
            answered: sql<number>`count(*)`,
          })
          .from(questionResponses)
          .innerJoin(stepQuestions, eq(stepQuestions.questionId, questionResponses.questionId))
          .where(and(inArray(questionResponses.sellerId, sellerIds), inArray(stepQuestions.stepId, stepIds)))
          .groupBy(questionResponses.sellerId, stepQuestions.stepId)
      )
    : [];
  const answeredBySellerStep = new Map<string, number>();
  for (const r of answeredRows) {
    answeredBySellerStep.set(`${r.sellerId}:${r.stepId}`, Number(r.answered));
  }

  // Resolve marker emails (derive at render time)
  const markerIds = Array.from(new Set(pageItems.map((r) => r.receivedReturnMarkedByUserId).filter(Boolean))) as number[];
  const markerMap = new Map<number, string>();
  if (markerIds.length) {
    const markers = await withPlatformDb((db) =>
      db
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(inArray(users.id, markerIds))
    );
    for (const m of markers) markerMap.set(m.id, m.email);
  }

  const steps = stepRows.map((s) => ({ id: s.id, key: s.key, title: s.title, total: totalByStep.get(s.id) ?? 0 }));

  function countAssessmentAnswered(data?: SellerAssessmentData | null): number {
    const d = data ?? null;
    if (!d) return 0;
    let count = 0;
    // 1 solution
    if (d.solution && ["unlock_full_service", "unlock_response", "unlock_fulfillment"].includes(d.solution)) count++;
    // 2 vendaPorRegiao
    const v: Partial<NonNullable<SellerAssessmentData['vendaPorRegiao']>> = d.vendaPorRegiao || {};
    const regions: Array<keyof NonNullable<SellerAssessmentData['vendaPorRegiao']>> = ["sul", "sudeste", "norte", "nordeste", "centroOeste"];
    const isFiniteNonNegative = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
    if (regions.every((r) => isFiniteNonNegative(v[r]))) count++;
    // 3 modeloFiscal (at least one)
    const mf = d.modeloFiscal || {};
    if (mf.compraEVenda || mf.filial || mf.remessaArmazemGeral) count++;
    const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
    // 4..13 required numerics/text
    if (isNum(d.volumeMensalPedidos)) count++;
    if (typeof d.itensPorPedido === "number" && Number.isFinite(d.itensPorPedido) && d.itensPorPedido > 0) count++;
    if (isNum(d.skus)) count++;
    if (isNum(d.ticketMedio)) count++;
    if (d.canais && String(d.canais).trim()) count++;
    if (isNum(d.gmvFlagshipMensal)) count++;
    if (isNum(d.gmvMarketplacesMensal)) count++;
    if (isNum(d.mesesCoberturaEstoque)) count++;
    if (d.perfilProduto && String(d.perfilProduto).trim()) count++;
    if (isNum(d.pesoMedioKg)) count++;
    // 14 dimensoes (c,l,a)
    const dim: Partial<NonNullable<SellerAssessmentData['dimensoesCm']>> = d.dimensoesCm || {};
    if (isNum(dim.c) && isNum(dim.l) && isNum(dim.a)) count++;
    // 15 reversaPercent 0..100
    if (typeof d.reversaPercent === "number" && Number.isFinite(d.reversaPercent) && d.reversaPercent >= 0 && d.reversaPercent <= 100) count++;
    // 16 projetosEspeciais
    if (d.projetosEspeciais && String(d.projetosEspeciais).trim()) count++;
    return count;
  }

  const sellers = pageItems.map((s) => {
    // Index progress sums
    const answered = steps.reduce((sum, st) => sum + (answeredBySellerStep.get(`${s.id}:${st.id}`) ?? 0), 0);
    const total = steps.reduce((sum, st) => sum + st.total, 0);
    const assessmentAnswered = countAssessmentAnswered(s.assessData ?? null);
    const assessmentTotal = 16;
    return {
      id: s.id,
      email: s.email,
      lastLoginAt: s.lastLoginAt,
      showIndex: Boolean(s.showIndex),
      showAssessment: Boolean(s.showAssessment),
      reachedResultsAt: s.reachedStep8At,
      indexAnswered: answered,
      indexTotal: total,
      assessmentAnswered,
      assessmentTotal,
      assessmentStatus: s.assessStatus ?? "draft",
      assessmentSubmittedAt: s.assessSubmittedAt,
    };
  });

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Image
            src="/unlock-minal-logo-branco.svg"
            alt="Unlock logo"
            width={75}
            height={43}
          />
          <LogoutButton />
        </div>
        <SellerTable
          q={q}
          sellers={sellers}
          nextCursor={nextCursor}
          limit={limit}
        />
      </div>
    </main>
  );
}
