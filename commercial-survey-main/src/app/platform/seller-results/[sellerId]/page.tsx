import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
// Image not used; header uses inline SVG mark
import InventaLogoMark from "@/components/inventa-logo-mark";
import LogoutButton from "../../../logout-button";
import { withPlatformDb } from "@/db/client";
import {
  users,
  surveySteps,
  stepQuestions,
  questions,
  questionOptions,
  questionResponses,
  sellerAssessments,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { Card } from "@/components/card";
import IndexCard from "./index-card";
import AssessmentCard from "./assessment-card";
import VisibilityToggles from "./visibility-toggles";

type Params = { sellerId: string };

export default async function PlatformSellerResultsPage({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) redirect("/");
  if (role !== "platform") {
    if (role === "seller") redirect("/seller/home");
    redirect("/");
  }

  const sellerId = Number(params.sellerId);
  if (!Number.isFinite(sellerId) || sellerId <= 0) notFound();

  // Header info
  const sellerRow = await withPlatformDb((db) =>
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        lastLoginAt: users.lastLoginAt,
        showIndex: users.showIndex,
        showAssessment: users.showAssessment,
      })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1)
  );
  const seller = sellerRow[0];
  if (!seller) notFound();

  // Steps (active)
  const stepRows = await withPlatformDb((db) =>
    db
      .select({ id: surveySteps.id, key: surveySteps.key, title: surveySteps.title, order: surveySteps.order })
      .from(surveySteps)
      .where(eq(surveySteps.isActive, true))
      .orderBy(surveySteps.order)
  );
  const stepIds = stepRows.map((s) => s.id);

  // Questions by step
  const stepQuestionsRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ stepId: stepQuestions.stepId, questionId: stepQuestions.questionId, qOrder: stepQuestions.order })
          .from(stepQuestions)
          .where(inArray(stepQuestions.stepId, stepIds))
      )
    : [];
  const questionsByStep = new Map<number, Set<number>>();
  for (const r of stepQuestionsRows) {
    const set = questionsByStep.get(r.stepId) ?? new Set<number>();
    set.add(r.questionId);
    questionsByStep.set(r.stepId, set);
  }
  const allQuestionIds = Array.from(new Set(stepQuestionsRows.map((r) => r.questionId)));

  // Max score per step
  const optionRows = allQuestionIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, score: questionOptions.score, label: questionOptions.label })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, allQuestionIds))
      )
    : [];
  const maxScoreByStep = new Map<number, number>();
  for (const s of stepRows) {
    const qIds = questionsByStep.get(s.id) ?? new Set<number>();
    let max = 0;
    for (const qId of qIds) {
      for (const o of optionRows) {
        if (o.questionId === qId && o.score > max) max = o.score;
      }
    }
    maxScoreByStep.set(s.id, max || 5);
  }

  // Averages per step for this seller
  const avgRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ stepId: surveySteps.id, avgScore: sql<number>`avg(${questionOptions.score})` })
          .from(questionResponses)
          .innerJoin(questions, eq(questionResponses.questionId, questions.id))
          .innerJoin(stepQuestions, eq(stepQuestions.questionId, questions.id))
          .innerJoin(surveySteps, eq(stepQuestions.stepId, surveySteps.id))
          .innerJoin(questionOptions, eq(questionResponses.optionId, questionOptions.id))
          .where(and(eq(questionResponses.sellerId, sellerId), inArray(surveySteps.id, stepIds)))
          .groupBy(surveySteps.id)
      )
    : [];
  const avgByStep = new Map<number, number>(avgRows.map((r) => [r.stepId, Number(r.avgScore)]));

  const dims = stepRows.map((s) => ({
    title: s.title,
    order: s.order,
    average: Number((avgByStep.get(s.id) ?? 0).toFixed?.(2) ?? (avgByStep.get(s.id) ?? 0)),
    max: maxScoreByStep.get(s.id) ?? 5,
  }));
  const radarData = stepRows.map((s) => ({
    label: s.title,
    value: Number((avgByStep.get(s.id) ?? 0).toFixed?.(2) ?? (avgByStep.get(s.id) ?? 0)),
    max: maxScoreByStep.get(s.id) ?? 5,
  }));
  const generalAverage = (() => {
    if (!dims.length) return null;
    const sum = dims.reduce((acc, d) => acc + (typeof d.average === "number" ? d.average : Number(d.average)), 0);
    const avg = sum / dims.length;
    return Number(avg.toFixed(1));
  })();

  // Detail sections with questions and answers
  // Fetch question meta
  const qRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({
            stepId: stepQuestions.stepId,
            stepOrder: surveySteps.order,
            stepTitle: surveySteps.title,
            qId: questions.id,
            qLabel: questions.label,
            qOrder: stepQuestions.order,
          })
          .from(stepQuestions)
          .innerJoin(questions, eq(stepQuestions.questionId, questions.id))
          .innerJoin(surveySteps, eq(stepQuestions.stepId, surveySteps.id))
          .where(inArray(stepQuestions.stepId, stepIds))
          .orderBy(surveySteps.order, stepQuestions.order)
      )
    : [];

  const perQuestionOptions = allQuestionIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, label: questionOptions.label, score: questionOptions.score, order: questionOptions.order })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, allQuestionIds))
      )
    : [];
  const optionsByQuestion = new Map<number, { id: number; label: string; score: number; order: number }[]>();
  const optionById = new Map<number, { label: string; score: number }>();
  for (const o of perQuestionOptions) {
    optionById.set(o.id, { label: o.label, score: o.score });
    const arr = optionsByQuestion.get(o.questionId) ?? [];
    arr.push(o);
    optionsByQuestion.set(o.questionId, arr);
  }
  const selectedRows = allQuestionIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ questionId: questionResponses.questionId, optionId: questionResponses.optionId })
          .from(questionResponses)
          .where(and(eq(questionResponses.sellerId, sellerId), inArray(questionResponses.questionId, allQuestionIds)))
      )
    : [];
  const selectedByQuestion = new Map<number, number>(selectedRows.map((r) => [r.questionId, r.optionId]));

  const sections = stepRows.map((s) => {
    const qs = qRows.filter((r) => r.stepId === s.id).sort((a, b) => a.qOrder - b.qOrder);
    let subtotal = 0;
    let maxSubtotal = 0;
    const items = qs.map((r) => {
      const selectedOptId = selectedByQuestion.get(r.qId);
      const selected = selectedOptId ? optionById.get(selectedOptId) : null;
      const opts = optionsByQuestion.get(r.qId) ?? [];
      const qMax = opts.reduce((m, o) => (o.score > m ? o.score : m), 0);
      maxSubtotal += qMax;
      const score = selected?.score ?? 0;
      subtotal += score;
      return { question: r.qLabel, answer: selected?.label ?? "—", score };
    });
    return { stepId: s.id, title: s.title, order: s.order, items, subtotal, maxSubtotal };
  });

  // Assessment
  const assessRow = await withPlatformDb((db) =>
    db
      .select({ status: sellerAssessments.status, data: sellerAssessments.data, submittedAt: sellerAssessments.submittedAt, updatedAt: sellerAssessments.updatedAt })
      .from(sellerAssessments)
      .where(eq(sellerAssessments.sellerId, sellerId))
      .limit(1)
  );
  const assessment = assessRow[0]
    ? {
        status: assessRow[0].status,
        data: assessRow[0].data,
        submittedAt: assessRow[0].submittedAt ?? null,
        updatedAt: assessRow[0].updatedAt ?? null,
      }
    : null;

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <InventaLogoMark width={75} height={43} />
          <LogoutButton />
        </div>

        {/* Header with seller info + toggles */}
        <Card className="p-4 mb-6 bg-white text-[#111827]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-lg font-semibold">{seller.name || seller.email}</div>
              <div className="text-sm text-[#6b7280]">{seller.email}</div>
              <div className="text-xs text-[#6b7280]">ID: {seller.id} · Role: {String(seller.role)} · Verificado: {seller.emailVerified ? "Sim" : "Não"}</div>
              <div className="text-xs text-[#6b7280]">Criado: {fmt(seller.createdAt)} · Último acesso: {fmt(seller.lastLoginAt)} · Atualizado: {fmt(seller.updatedAt)}</div>
            </div>
            <div className="flex items-center gap-3">
              <VisibilityToggles sellerId={seller.id} showIndex={!!seller.showIndex} showAssessment={!!seller.showAssessment} />
              <Link
                href="/platform"
                aria-label="Voltar para a listagem"
                className="inline-flex items-center justify-center rounded-xl bg-[#B8F4F7] px-5 py-2 text-sm text-[#2A2AE6] transition-colors transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]"
              >
                Voltar
              </Link>
            </div>
          </div>
        </Card>

        {/* Index Summary + details */}
        <div className="mb-6">
          <IndexCard radarData={radarData} dims={dims} generalAverage={generalAverage} sections={sections} sellerId={seller.id} />
        </div>

        {/* Assessment Summary + details */}
        <div className="mb-6">
          <AssessmentCard assessment={assessment} sellerId={seller.id} />
        </div>
      </div>
    </main>
  );
}

function fmt(d: Date | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return String(d); }
}
