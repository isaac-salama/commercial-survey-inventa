"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { withSellerDb } from "@/db/client";
import { getServerFeatureFlags } from "@/config/features";
import {
  surveySteps,
  questions,
  questionOptions,
  stepQuestions,
  questionResponses,
  sellerProgress,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

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

export type SaveStepAnswersInput = {
  stepKey: string;
  answers: { questionKey: string; optionValue: "0" | "1" | "3" | "5" }[];
};

export async function saveStepAnswers(input: SaveStepAnswersInput): Promise<Result> {
  if (!input || typeof input.stepKey !== "string" || !Array.isArray(input.answers) || input.answers.length === 0) {
    return { ok: false, code: "INVALID_INPUT", message: "stepKey and non-empty answers are required" };
  }
  for (const a of input.answers) {
    if (!a || typeof a.questionKey !== "string" || !["0", "1", "3", "5"].includes(a.optionValue)) {
      return { ok: false, code: "INVALID_INPUT", message: "answers must include questionKey and optionValue in {0,1,3,5}" };
    }
  }

  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes;
  const sellerId = sellerIdRes.data!;

  const { lockResultsNav } = getServerFeatureFlags();
  const now = new Date();

  // Single scoped transaction for all DB reads/writes
  try {
    const result = await withSellerDb(sellerId, async (db) => {
      // Guard: once completed, disallow further saves (when feature enabled)
      if (lockResultsNav) {
        try {
          const check = await db
            .select({ reachedStep8: sellerProgress.reachedStep8, lastStepOrder: sellerProgress.lastStepOrder })
            .from(sellerProgress)
            .where(eq(sellerProgress.sellerId, sellerId))
            .limit(1);
          const progress = check[0];
          if (progress && (progress.reachedStep8 || (progress.lastStepOrder ?? 0) >= 8)) {
            return { kind: "completed" as const };
          }
        } catch {
          // ignore
        }
      }

      // Resolve step
      const stepRows = await db
        .select({ id: surveySteps.id, order: surveySteps.order, isActive: surveySteps.isActive })
        .from(surveySteps)
        .where(eq(surveySteps.key, input.stepKey))
        .limit(1);
      const step = stepRows[0];
      if (!step || !step.isActive) {
        return { kind: "error" as const, code: "STEP_NOT_FOUND", message: "Step not found or inactive" };
      }

      // Resolve questions mapping and validate membership to step
      const qKeys = input.answers.map((a) => a.questionKey);
      const rows = await db
        .select({ questionId: questions.id, questionKey: questions.key })
        .from(stepQuestions)
        .innerJoin(questions, eq(stepQuestions.questionId, questions.id))
        .where(and(eq(stepQuestions.stepId, step.id), inArray(questions.key, qKeys)));
      const byKey = new Map(rows.map((r) => [r.questionKey, r.questionId]));
      for (const k of qKeys) {
        if (!byKey.has(k)) {
          return {
            kind: "error" as const,
            code: "QUESTION_NOT_IN_STEP",
            message: `Question ${k} does not belong to step ${input.stepKey}`,
          };
        }
      }

      // Resolve optionIds for each answer
      const questionIds = rows.map((r) => r.questionId);
      const allOptions = questionIds.length
        ? await db
            .select({ id: questionOptions.id, questionId: questionOptions.questionId, value: questionOptions.value })
            .from(questionOptions)
            .where(
              and(inArray(questionOptions.questionId, questionIds), inArray(questionOptions.value, ["0", "1", "3", "5"]))
            )
        : [];
      const optionLookup = new Map<string, number>(); // `${questionId}:${value}` -> optionId
      for (const o of allOptions) optionLookup.set(`${o.questionId}:${o.value}`, o.id);

      // Build bulk values and validate options
      const values: { sellerId: number; questionId: number; optionId: number; createdAt: Date; updatedAt: Date }[] = [];
      for (const a of input.answers) {
        const qId = byKey.get(a.questionKey)!;
        const optId = optionLookup.get(`${qId}:${a.optionValue}`);
        if (!optId) {
          return { kind: "error" as const, code: "OPTION_NOT_FOUND", message: "Option not found" };
        }
        values.push({ sellerId, questionId: qId, optionId: optId, createdAt: now, updatedAt: now });
      }

      // Upsert in batch
      await db
        .insert(questionResponses)
        .values(values)
        .onConflictDoUpdate({
          target: [questionResponses.sellerId, questionResponses.questionId],
          set: { optionId: sql`excluded.option_id`, updatedAt: now },
        });

      // Update progress: last step/order (only increases order)
      await db
        .insert(sellerProgress)
        .values({ sellerId, lastStepId: step.id, lastStepOrder: step.order, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: sellerProgress.sellerId,
          set: {
            lastStepId: step.id,
            lastStepOrder: sql`${sql.raw("GREATEST")}(${sellerProgress.lastStepOrder}, ${step.order})`,
            updatedAt: now,
          },
        });

      return { kind: "ok" as const };
    });

    if (result.kind === "completed") return { ok: false, code: "SURVEY_COMPLETED", message: "Assessment already completed" };
    if (result.kind === "error") return { ok: false, code: result.code, message: result.message } as Result;
    return { ok: true };
  } catch (e) {
    throw e;
  }
}

export async function markReachedStep8(): Promise<Result> {
  const { lockResultsNav } = getServerFeatureFlags();
  if (!lockResultsNav) {
    // Feature disabled: do not persist completion lock
    return { ok: true };
  }
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes;
  const sellerId = sellerIdRes.data!;
  const now = new Date();
  // Upsert progress and mark step 8 reached
  await withSellerDb(sellerId, (db) =>
    db
      .insert(sellerProgress)
      .values({ sellerId, reachedStep8: true, reachedStep8At: now, lastStepOrder: 8, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: sellerProgress.sellerId,
        set: { reachedStep8: true, reachedStep8At: now, lastStepOrder: 8, updatedAt: now },
      })
  );

  return { ok: true };
}

export type GetStepWithQuestionsInput = { stepKey: string };
export type GetStepWithQuestionsOutput = {
  step: { key: string; title: string; order: number };
  questions: {
    key: string;
    label: string;
    order: number;
    options: { value: "0" | "1" | "3" | "5"; label: string; order: number }[];
    selected?: "0" | "1" | "3" | "5";
  }[];
};

type AnswerValue = "0" | "1" | "3" | "5";
function isAnswerValue(v: string): v is AnswerValue {
  return v === "0" || v === "1" || v === "3" || v === "5";
}

export async function getStepWithQuestions(
  input: GetStepWithQuestionsInput
): Promise<Result<GetStepWithQuestionsOutput>> {
  if (!input || typeof input.stepKey !== "string") {
    return { ok: false, code: "INVALID_INPUT", message: "stepKey is required" };
  }
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return { ok: false, code: sellerIdRes.code, message: sellerIdRes.message };
  const sellerId = sellerIdRes.data!;

  const { lockResultsNav } = getServerFeatureFlags();

  const result = await withSellerDb(sellerId, async (db) => {
    // Guard: once completed, disallow fetching earlier steps
    if (lockResultsNav) {
      try {
        const progressRows = await db
          .select({ reachedStep8: sellerProgress.reachedStep8, lastStepOrder: sellerProgress.lastStepOrder })
          .from(sellerProgress)
          .where(eq(sellerProgress.sellerId, sellerId))
          .limit(1);
        const progress = progressRows[0];
        if (progress && (progress.reachedStep8 || (progress.lastStepOrder ?? 0) >= 8)) {
          return { kind: "completed" as const };
        }
      } catch {
        // ignore
      }
    }

    // Step
    const stepRows = await db
      .select({ id: surveySteps.id, key: surveySteps.key, title: surveySteps.title, order: surveySteps.order, isActive: surveySteps.isActive })
      .from(surveySteps)
      .where(eq(surveySteps.key, input.stepKey))
      .limit(1);
    const step = stepRows[0];
    if (!step || !step.isActive) {
      return { kind: "error" as const, code: "STEP_NOT_FOUND", message: "Step not found or inactive" };
    }

    // Questions
    const qRows = await db
      .select({ qId: questions.id, qKey: questions.key, qLabel: questions.label, qOrder: stepQuestions.order })
      .from(stepQuestions)
      .innerJoin(questions, eq(stepQuestions.questionId, questions.id))
      .where(eq(stepQuestions.stepId, step.id))
      .orderBy(stepQuestions.order);
    const qIds = qRows.map((r) => r.qId);

    // Options
    const optRows = qIds.length
      ? await db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, value: questionOptions.value, label: questionOptions.label, order: questionOptions.order })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, qIds))
          .orderBy(questionOptions.questionId, questionOptions.order)
      : [];

    // Existing responses for this seller
    const respRows = qIds.length
      ? await db
          .select({ questionId: questionResponses.questionId, optionId: questionResponses.optionId })
          .from(questionResponses)
          .where(and(eq(questionResponses.sellerId, sellerId), inArray(questionResponses.questionId, qIds)))
      : [];

    const selectedByQ = new Map<number, number>(respRows.map((r) => [r.questionId, r.optionId]));
    const optionsByQ = new Map<number, { value: "0" | "1" | "3" | "5"; label: string; order: number }[]>();
    for (const o of optRows) {
      if (isAnswerValue(o.value)) {
        const arr = optionsByQ.get(o.questionId) ?? [];
        arr.push({ value: o.value, label: o.label, order: o.order });
        optionsByQ.set(o.questionId, arr);
      }
    }
    const valueByOptionId = new Map<number, "0" | "1" | "3" | "5">();
    for (const o of optRows) {
      if (isAnswerValue(o.value)) valueByOptionId.set(o.id, o.value);
    }

    return {
      kind: "ok" as const,
      data: {
        step: { key: step.key, title: step.title, order: step.order },
        questions: qRows.map((r) => {
          const selectedOptionId = selectedByQ.get(r.qId);
          const selected = selectedOptionId ? valueByOptionId.get(selectedOptionId) : undefined;
          return {
            key: r.qKey,
            label: r.qLabel,
            order: r.qOrder,
            options: optionsByQ.get(r.qId) ?? [],
            selected,
          };
        }),
      },
    };
  });

  if (result.kind === "completed") return { ok: false, code: "SURVEY_COMPLETED", message: "Assessment already completed" };
  if (result.kind === "error") return { ok: false, code: result.code, message: result.message } as Result<GetStepWithQuestionsOutput>;
  return { ok: true, data: result.data };
}

// Results by dimension (survey step) for the current seller
export type GetResultsByDimensionOutput = {
  dimensions: {
    key: string;
    title: string;
    order: number;
    averageScore: number; // average over answered questions in the step
    maxScore: number; // maximum attainable score in this step (for scaling)
    questionCount: number; // total questions in the step
    answeredCount: number; // how many were answered by this seller
  }[];
};

export async function getResultsByDimension(): Promise<Result<GetResultsByDimensionOutput>> {
  const sellerIdRes = await getSellerId();
  if (!sellerIdRes.ok) return sellerIdRes as Result<GetResultsByDimensionOutput>;
  const sellerId = sellerIdRes.data!;

  const data = await withSellerDb(sellerId, async (db) => {
    // 1) Collect active steps that have questions
    const stepRows = await db
      .select({ stepId: surveySteps.id, stepKey: surveySteps.key, stepTitle: surveySteps.title, stepOrder: surveySteps.order })
      .from(surveySteps)
      .innerJoin(stepQuestions, eq(stepQuestions.stepId, surveySteps.id))
      .where(eq(surveySteps.isActive, true))
      .orderBy(surveySteps.order);

    const stepsMap = new Map<number, { id: number; key: string; title: string; order: number }>();
    for (const r of stepRows) {
      if (!stepsMap.has(r.stepId)) stepsMap.set(r.stepId, { id: r.stepId, key: r.stepKey, title: r.stepTitle, order: r.stepOrder });
    }
    const steps = Array.from(stepsMap.values()).sort((a, b) => a.order - b.order);
    if (steps.length === 0) return { dimensions: [] } as GetResultsByDimensionOutput;

    const stepIds = steps.map((s) => s.id);

    // 2) Count total questions per step
    const stepQuestionsRows = await db
      .select({ stepId: stepQuestions.stepId, questionId: stepQuestions.questionId })
      .from(stepQuestions)
      .where(inArray(stepQuestions.stepId, stepIds));
    const questionsByStep = new Map<number, Set<number>>();
    for (const r of stepQuestionsRows) {
      const set = questionsByStep.get(r.stepId) ?? new Set<number>();
      set.add(r.questionId);
      questionsByStep.set(r.stepId, set);
    }

    // 3) Resolve max score per step
    const allQuestionIds = Array.from(new Set(stepQuestionsRows.map((r) => r.questionId)));
    let maxScoreByStep = new Map<number, number>();
    if (allQuestionIds.length > 0) {
      const optRows = await db
        .select({ questionId: questionOptions.questionId, score: questionOptions.score })
        .from(questionOptions)
        .where(inArray(questionOptions.questionId, allQuestionIds));
      maxScoreByStep = new Map<number, number>();
      for (const s of steps) {
        const qIds = questionsByStep.get(s.id) ?? new Set<number>();
        let max = 0;
        for (const qId of qIds) {
          for (const o of optRows) {
            if (o.questionId === qId && o.score > max) max = o.score;
          }
        }
        maxScoreByStep.set(s.id, max || 5);
      }
    }

    // 4) Compute averages per step for this seller
    const avgRows = await db
      .select({ stepId: surveySteps.id, avgScore: sql<number>`avg(${questionOptions.score})`, answeredCount: sql<number>`count(*)` })
      .from(questionResponses)
      .innerJoin(questions, eq(questionResponses.questionId, questions.id))
      .innerJoin(stepQuestions, eq(stepQuestions.questionId, questions.id))
      .innerJoin(surveySteps, eq(stepQuestions.stepId, surveySteps.id))
      .innerJoin(questionOptions, eq(questionResponses.optionId, questionOptions.id))
      .where(and(eq(questionResponses.sellerId, sellerId), inArray(surveySteps.id, stepIds)))
      .groupBy(surveySteps.id);
    const avgByStep = new Map<number, { avg: number; answered: number }>();
    for (const r of avgRows) {
      const avg = typeof r.avgScore === "number" ? r.avgScore : Number(r.avgScore);
      const answered = typeof r.answeredCount === "number" ? r.answeredCount : Number(r.answeredCount);
      avgByStep.set(r.stepId, { avg, answered });
    }

    // 5) Build output
    const dimensions = steps.map((s) => {
      const totalQ = questionsByStep.get(s.id)?.size ?? 0;
      const agg = avgByStep.get(s.id);
      const avg = agg?.avg ?? 0;
      const answered = agg?.answered ?? 0;
      const max = maxScoreByStep.get(s.id) ?? 5;
      return {
        key: s.key,
        title: s.title,
        order: s.order,
        averageScore: Number((avg as number)?.toFixed?.(2) ?? avg),
        maxScore: max,
        questionCount: totalQ,
        answeredCount: answered,
      };
    });

    return { dimensions } as GetResultsByDimensionOutput;
  });

  return { ok: true, data };
}
