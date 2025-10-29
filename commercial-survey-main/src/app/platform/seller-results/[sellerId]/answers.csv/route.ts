import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { withPlatformDb } from "@/db/client";
import { users, surveySteps, stepQuestions, questions, questionResponses, questionOptions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

type Params = { sellerId: string };

export async function GET(_req: NextRequest, context: { params: Promise<Params> }) {
  const { sellerId } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "platform") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const sellerIdNum = Number(sellerId);
  if (!Number.isFinite(sellerIdNum) || sellerIdNum <= 0) {
    return new NextResponse("Invalid sellerId", { status: 400 });
  }

  // Resolve seller email
  const sellerRow = await withPlatformDb((db) =>
    db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, sellerIdNum))
      .limit(1)
  );
  const seller = sellerRow[0];
  if (!seller) return new NextResponse("Not found", { status: 404 });

  // Steps that have questions and are active
  const stepRows = await withPlatformDb((db) =>
    db
      .select({
        id: surveySteps.id,
        key: surveySteps.key,
        title: surveySteps.title,
        order: surveySteps.order,
      })
      .from(surveySteps)
      .innerJoin(stepQuestions, eq(stepQuestions.stepId, surveySteps.id))
      .where(eq(surveySteps.isActive, true))
      .orderBy(surveySteps.order)
  );
  const stepIds = Array.from(new Set(stepRows.map((s) => s.id)));
  if (stepIds.length === 0) {
    const header = [
      "sellerId",
      "sellerEmail",
      "stepOrder",
      "stepKey",
      "stepTitle",
      "questionOrder",
      "questionKey",
      "questionLabel",
      "optionValue",
      "optionLabel",
      "optionScore",
      "answeredAt",
    ].join(",");
    return new NextResponse(header + "\n", {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=answers-${seller.id}.csv`,
      },
    });
  }

  // Build base questions per step
  const questionRows = await withPlatformDb((db) =>
    db
      .select({
        stepId: stepQuestions.stepId,
        stepOrder: surveySteps.order,
        stepKey: surveySteps.key,
        stepTitle: surveySteps.title,
        questionId: questions.id,
        questionKey: questions.key,
        questionLabel: questions.label,
        questionOrder: stepQuestions.order,
        optionId: questionResponses.optionId,
        answeredAt: questionResponses.updatedAt,
      })
      .from(stepQuestions)
      .innerJoin(surveySteps, eq(stepQuestions.stepId, surveySteps.id))
      .innerJoin(questions, eq(stepQuestions.questionId, questions.id))
      .leftJoin(
        questionResponses,
        and(eq(questionResponses.questionId, questions.id), eq(questionResponses.sellerId, sellerIdNum))
      )
      .where(inArray(stepQuestions.stepId, stepIds))
      .orderBy(surveySteps.order, stepQuestions.order)
  );

  const allQIds = Array.from(new Set(questionRows.map((r) => r.questionId)));
  const optRows = allQIds.length
    ? await withPlatformDb((db) =>
        db
          .select({ id: questionOptions.id, questionId: questionOptions.questionId, value: questionOptions.value, label: questionOptions.label, score: questionOptions.score })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, allQIds))
      )
    : [];
  const optionById = new Map<number, { value: string; label: string; score: number }>();
  for (const o of optRows) optionById.set(o.id, { value: o.value, label: o.label, score: o.score });

  const lines: string[] = [];
  const header = [
    "sellerId",
    "sellerEmail",
    "stepOrder",
    "stepKey",
    "stepTitle",
    "questionOrder",
    "questionKey",
    "questionLabel",
    "optionValue",
    "optionLabel",
    "optionScore",
    "answeredAt",
  ];
  lines.push(header.join(","));

  for (const r of questionRows) {
    const opt = r.optionId ? optionById.get(r.optionId) : null;
    const row = [
      String(seller.id),
      csvEscape(seller.email),
      String(r.stepOrder ?? ""),
      csvEscape(r.stepKey ?? ""),
      csvEscape(r.stepTitle ?? ""),
      String(r.questionOrder ?? ""),
      csvEscape(r.questionKey ?? ""),
      csvEscape((r.questionLabel as unknown as string) ?? ""),
      csvEscape(opt?.value ?? ""),
      csvEscape(opt?.label ?? ""),
      String(opt?.score ?? ""),
      csvEscape(r.answeredAt ? new Date(r.answeredAt as unknown as string).toISOString() : ""),
    ];
    lines.push(row.join(","));
  }

  return new NextResponse(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=answers-${seller.id}.csv`,
    },
  });
}

function csvEscape(s: string) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  return needs ? '"' + s.replace(/"/g, '""') + '"' : s;
}
