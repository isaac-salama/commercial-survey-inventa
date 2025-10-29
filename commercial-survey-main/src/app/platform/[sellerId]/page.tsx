import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import LogoutButton from "../../logout-button";
import { withPlatformDb } from "@/db/client";
import {
  users,
  surveySteps,
  stepQuestions,
  questions,
  questionOptions,
  questionResponses,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import ResultsRadar from "@/components/results-radar";
import { Card } from "@/components/card";

type Params = { sellerId: string };

export default async function PlatformSellerDetailPage({ params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) redirect("/");
  if (role !== "platform") {
    if (role === "seller") redirect("/seller/home");
    redirect("/");
  }

  const sellerId = Number(params.sellerId);
  if (!Number.isFinite(sellerId) || sellerId <= 0) notFound();

  // Header info: email (only)
  const sellerRow = await withPlatformDb((db) =>
    db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1)
  );
  const seller = sellerRow[0];
  if (!seller) notFound();

  // Active steps ordered
  const stepRows = await withPlatformDb((db) =>
    db
      .select({ id: surveySteps.id, key: surveySteps.key, title: surveySteps.title, order: surveySteps.order })
      .from(surveySteps)
      .where(eq(surveySteps.isActive, true))
      .orderBy(surveySteps.order)
  );
  const stepIds = stepRows.map((s) => s.id);

  // Totals per step
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

  // Answered counts per step for this seller
  const answeredRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ stepId: stepQuestions.stepId, answered: sql<number>`count(*)` })
          .from(questionResponses)
          .innerJoin(stepQuestions, eq(stepQuestions.questionId, questionResponses.questionId))
          .where(and(eq(questionResponses.sellerId, sellerId), inArray(stepQuestions.stepId, stepIds)))
          .groupBy(stepQuestions.stepId)
      )
    : [];
  const answeredByStep = new Map<number, number>(answeredRows.map((r) => [r.stepId, Number(r.answered)]));

  // Build radar data (reuse seller/results logic, parameterized by sellerId)
  // 1) Steps with questions are already fetched
  const stepQuestionsRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ stepId: stepQuestions.stepId, questionId: stepQuestions.questionId })
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
  const optionRows = allQuestionIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, score: questionOptions.score })
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

  const avgRows = stepIds.length
    ? await withPlatformDb((db) =>
        db
          .select({
            stepId: surveySteps.id,
            avgScore: sql<number>`avg(${questionOptions.score})`,
          })
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
  const radarData = stepRows.map((s) => ({
    label: s.title,
    value: Number((avgByStep.get(s.id) ?? 0).toFixed?.(2) ?? (avgByStep.get(s.id) ?? 0)),
    max: maxScoreByStep.get(s.id) ?? 5,
  }));

  // Answers by section (include unanswered), with per-section subtotal N / Max
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
          .select({
            id: questionOptions.id,
            questionId: questionOptions.questionId,
            label: questionOptions.label,
            score: questionOptions.score,
            order: questionOptions.order,
          })
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
  // Selected responses
  const selectedRows = allQuestionIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ questionId: questionResponses.questionId, optionId: questionResponses.optionId })
          .from(questionResponses)
          .where(and(eq(questionResponses.sellerId, sellerId), inArray(questionResponses.questionId, allQuestionIds)))
      )
    : [];
  const selectedByQuestion = new Map<number, number>(selectedRows.map((r) => [r.questionId, r.optionId]));

  // Build sections
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

  return (
    <main className="min-h-screen px-4 pb-4 pt-8 bg-[#3135ef] text-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10">
          <Image src="/unlock-minal-logo-branco.svg" alt="Unlock logo" width={75} height={43} />
          <LogoutButton />
        </div>

        {/* Header with seller info */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Seller: {seller.email}</h1>
          <Link
            href="/platform"
            aria-label="Voltar para a listagem"
            className="inline-flex items-center justify-center rounded-xl bg-[#B8F4F7] px-5 py-2 text-sm text-[#2A2AE6] transition-colors transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]"
          >
            Voltar
          </Link>
        </div>

        {/* Summary: Radar + answered/total per step */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4 bg-white text-[#111827]">
            <h2 className="text-lg font-semibold mb-3">Resumo de Resultados</h2>
            <ResultsRadar data={radarData} />
          </Card>
          <Card className="p-4 bg-white text-[#111827]">
            <h2 className="text-lg font-semibold mb-3">Perguntas respondidas / total</h2>
            <ul className="space-y-2">
              {stepRows.map((st) => {
                const answered = answeredByStep.get(st.id) ?? 0;
                const total = totalByStep.get(st.id) ?? 0;
                const prefix = total === 0 ? "🔴" : answered === 0 ? "🔴" : answered === total ? "🟢" : "🟠";
                return (
                  <li key={st.id} className="flex items-center justify-between">
                    <span className="text-[#3a3a3a]">{st.title}</span>
                    <span className="font-medium">{prefix} {answered}/{total}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Answers grouped by section */}
        <div className="space-y-4">
          {sections.map((sec) => (
            <Card key={sec.stepId} className="p-4 bg-white text-[#111827]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">{sec.title}</h3>
                <div className="text-sm font-medium">Subtotal: {sec.subtotal} / {sec.maxSubtotal}</div>
              </div>
              {sec.items.length === 0 ? (
                <p className="text-sm text-[#6b7280]">Sem perguntas nesta seção.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="px-2 py-2 font-medium">Pergunta</th>
                      <th className="px-2 py-2 font-medium">Resposta</th>
                      <th className="px-2 py-2 font-medium text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.items.map((it, idx) => (
                      <tr key={idx} className="border-b last:border-b-0">
                        <td className="px-2 py-2 align-top">{it.question}</td>
                        <td className="px-2 py-2 align-top">{it.answer}</td>
                        <td className="px-2 py-2 align-top text-right">{it.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
