"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ProgressSteps } from "@/components/progress-steps";
import { Card } from "@/components/card";
import { PrimaryButton } from "@/components/primary-button";
import { UnlockLoader } from "@/components/unlock-loader";
import {
  getStepWithQuestions,
  saveStepAnswers,
  markReachedStep8,
  getResultsByDimension,
  type GetStepWithQuestionsOutput,
  type GetResultsByDimensionOutput,
} from "./actions";
import ResultsRadar from "@/components/results-radar";

const STEP_LABELS = [
  "Início",
  "Payments",
  "Warehouse",
  "Delivery",
  "CX",
  "Analytics",
  "Organização",
  "Resultado",
] as const;

// Map each UI step index to a backend step key (null = no backend for that step)
const STEP_KEYS: (null | string)[] = [
  null,
  "payments",
  "warehouse",
  "delivery",
  "cx",
  "analytics",
  "organizacao",
  null,
];

type AnswerValue = "0" | "1" | "3" | "5";
type AnswersByQuestion = Record<string, AnswerValue>;

type Props = { resultsOnly?: boolean; lockResultsNav?: boolean };

export default function SellerWizard({ resultsOnly = false, lockResultsNav = true }: Props) {
  const [currentStep, setCurrentStep] = useState(() => (resultsOnly && lockResultsNav ? 7 : 0));
  const lastIndex = STEP_LABELS.length - 1;

  // Cache per-step data and answers
  const [stepData, setStepData] = useState<Record<number, GetStepWithQuestionsOutput | undefined>>({});
  const [loadingStep, setLoadingStep] = useState<Record<number, boolean>>({});
  const [loadError, setLoadError] = useState<Record<number, string | null>>({});
  const [answersByStep, setAnswersByStep] = useState<Record<number, AnswersByQuestion>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [advancing, setAdvancing] = useState(false);

  // Results (step 7)
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<
    | null
    | {
        label: string;
        value: number;
        max: number;
      }[]
  >(null);
  const [resultsDims, setResultsDims] = useState<GetResultsByDimensionOutput["dimensions"] | null>(null);

  // Mark step 8 (index 7) on arrival once
  const step8Marked = useRef(false);
  useEffect(() => {
    if (lockResultsNav && currentStep === 7 && !step8Marked.current) {
      step8Marked.current = true;
      // Fire-and-forget; errors will be silently ignored here
      markReachedStep8();
    }
  }, [currentStep, lockResultsNav]);

  // Load results when entering step 7 (always refetch on entry)
  useEffect(() => {
    if (currentStep !== 7) return;
    setResultsError(null);
    setResultsLoading(true);
    setResultsData(null);
    setResultsDims(null);
    let cancelled = false;
    getResultsByDimension()
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setResultsError(res.message || "Erro ao carregar resultados");
          return;
        }
        const dims = res.data?.dimensions ?? [];
        const mapped = dims.map((d) => ({ label: d.title, value: d.averageScore, max: d.maxScore }));
        setResultsData(mapped);
        setResultsDims(dims);
      })
      .catch(() => {
        if (!cancelled) setResultsError("Erro ao carregar resultados");
      })
      .finally(() => {
        if (!cancelled) setResultsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentStep]);

  // Unlock Index (média geral) = média aritmética das médias das seções, 1 casa decimal
  const generalAverage = useMemo(() => {
    if (!resultsDims || resultsDims.length === 0) return null;
    const sum = resultsDims.reduce((acc, d) => acc + (typeof d.averageScore === "number" ? d.averageScore : Number(d.averageScore)), 0);
    const avg = sum / resultsDims.length;
    return Number(avg.toFixed(1));
  }, [resultsDims]);

  // Ordenação da lista por ordem do backend
  const orderedDims = useMemo(() => {
    if (!resultsDims) return [] as GetResultsByDimensionOutput["dimensions"];
    return [...resultsDims].sort((a, b) => a.order - b.order);
  }, [resultsDims]);

  // Color helpers by threshold
  const bgClass = (value: number) =>
    value >= 4.0 ? "bg-green-600" : value <= 1.5 ? "bg-red-600" : "bg-amber-500";

  // Small pill for scores
  const ScorePill: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-medium text-white ${bgClass(
        value
      )} ${className || ""}`}
    >
      {value.toFixed(1)}
    </span>
  );

  // Micro progress bar 0..max (default 5) with markers at 1.5 and 4.0
  const MicroBar: React.FC<{ value: number; max?: number }> = ({ value, max = 5 }) => {
    const safeMax = max > 0 ? max : 5;
    const v = Math.max(0, Math.min(value, safeMax));
    const pct = (v / safeMax) * 100;
    const m1 = (1.5 / safeMax) * 100;
    const m2 = (4.0 / safeMax) * 100;
    return (
      <div className="relative h-2 w-full rounded-full bg-gray-200">
        <div className={`absolute left-0 top-0 h-2 rounded-full ${bgClass(value)}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-2 w-px bg-gray-400 -translate-x-1/2" style={{ left: `${m1}%` }} />
        <div className="absolute top-0 h-2 w-px bg-gray-400 -translate-x-1/2" style={{ left: `${m2}%` }} />
      </div>
    );
  };

  // Load questions when entering steps 1..6
  useEffect(() => {
    const stepKey = STEP_KEYS[currentStep];
    if (!stepKey) return; // intro or result
    if (stepData[currentStep] || loadingStep[currentStep]) return; // already loaded or loading
    setLoadError((e) => ({ ...e, [currentStep]: null }));
    setLoadingStep((l) => ({ ...l, [currentStep]: true }));

    getStepWithQuestions({ stepKey })
      .then((res) => {
        if (!res.ok) {
          setLoadError((e) => ({ ...e, [currentStep]: res.message || "Erro ao carregar" }));
          return;
        }
        setStepData((d) => ({ ...d, [currentStep]: res.data! }));
        // Prefill answers from selected values (if any)
        const prefill: AnswersByQuestion = {};
        for (const q of res.data!.questions) {
          if (q.selected) prefill[q.key] = q.selected;
        }
        if (Object.keys(prefill).length > 0) {
          setAnswersByStep((a) => ({ ...a, [currentStep]: { ...(a[currentStep] || {}), ...prefill } }));
        }
      })
      .catch(() => {
        setLoadError((e) => ({ ...e, [currentStep]: "Erro ao carregar" }));
      })
      .finally(() => {
        setLoadingStep((l) => ({ ...l, [currentStep]: false }));
      });
  }, [currentStep, stepData, loadingStep]);

  // Prefetch next step's questions (1-step lookahead) to avoid sequential waits
  useEffect(() => {
    const nextIndex = currentStep + 1;
    if (nextIndex > lastIndex) return;
    const nextKey = STEP_KEYS[nextIndex];
    if (!nextKey) return; // next is intro/result, nothing to prefetch
    if (stepData[nextIndex] || loadingStep[nextIndex]) return; // already cached or in-flight

    setLoadError((e) => ({ ...e, [nextIndex]: null }));
    setLoadingStep((l) => ({ ...l, [nextIndex]: true }));
    getStepWithQuestions({ stepKey: nextKey })
      .then((res) => {
        if (!res.ok) {
          setLoadError((e) => ({ ...e, [nextIndex]: res.message || "Erro ao carregar" }));
          return;
        }
        setStepData((d) => ({ ...d, [nextIndex]: res.data! }));
        // Prefill answers for next step if previously selected
        const prefill: AnswersByQuestion = {};
        for (const q of res.data!.questions) {
          if (q.selected) prefill[q.key] = q.selected;
        }
        if (Object.keys(prefill).length > 0) {
          setAnswersByStep((a) => ({ ...a, [nextIndex]: { ...(a[nextIndex] || {}), ...prefill } }));
        }
      })
      .catch(() => {
        setLoadError((e) => ({ ...e, [nextIndex]: "Erro ao carregar" }));
      })
      .finally(() => {
        setLoadingStep((l) => ({ ...l, [nextIndex]: false }));
      });
  }, [currentStep, lastIndex, stepData, loadingStep]);

  const isLast = currentStep === lastIndex;
  const isFirst = currentStep === 0;

  const currentData = stepData[currentStep];
  const isLoading = !!loadingStep[currentStep];
  const fetchError = loadError[currentStep] || null;

  const currentAnswers = useMemo(() => answersByStep[currentStep] ?? {}, [answersByStep, currentStep]);
  const allAnswered = useMemo(() => {
    const key = STEP_KEYS[currentStep];
    if (!key) return true; // intro/result step
    if (!currentData) return false; // wait for data
    if (currentData.questions.length === 0) return true; // nothing to answer
    return currentData.questions.every((q) => Boolean(currentAnswers[q.key]));
  }, [currentStep, currentData, currentAnswers]);

  const visibleTitle = useMemo(() => {
    const defaultLabel = STEP_LABELS[currentStep];
    // For steps 1..6, prefer backend-provided title if present
    if (currentData?.step?.title) return currentData.step.title;
    return defaultLabel;
  }, [currentStep, currentData]);

  // Hide any explicit 1/3/5 prefixes in option labels while keeping semantics.
  // Examples removed: "1 - Básico", "3: Intermediário", "5) Avançado".
  const sanitizeOptionLabel = (label: string) =>
    label.replace(/^\s*[135]\s*[\-–—.:)]?\s*/u, "").trim();

  const handleSelect = (qKey: string, value: AnswerValue) => {
    setAnswersByStep((prev) => ({
      ...prev,
      [currentStep]: { ...(prev[currentStep] || {}), [qKey]: value },
    }));
  };

  const handleNext = () => {
    setSaveError(null);
    setAdvancing(true);
    const stepKey = STEP_KEYS[currentStep];
    if (!stepKey) {
      setCurrentStep((i) => Math.min(i + 1, lastIndex));
      return;
    }
    // Require all answered; guard on client
    if (!currentData) return; // still loading
    if (!allAnswered) return; // should be disabled anyway
    const answers = currentData.questions.map((q) => ({
      questionKey: q.key,
      optionValue: currentAnswers[q.key] as AnswerValue,
    }));

    startSaving(async () => {
      const res = await saveStepAnswers({ stepKey, answers });
      if (!res.ok) {
        // If already completed, move to results permanently
        if (res.code === "SURVEY_COMPLETED") {
          setCurrentStep(7);
        } else {
          setSaveError(res.message || "Erro ao guardar respostas");
        }
        // Stop overlay on error
        setAdvancing(false);
        return;
      }
      // Invalidate cached results so next entry to step 7 refetches
      setResultsData(null);
      setResultsError(null);
      setCurrentStep((i) => Math.min(i + 1, lastIndex));
      // Do not clear advancing here; let the auto-hide effect handle it
    });
  };

  const handleBack = () => setCurrentStep((i) => Math.max(i - 1, 0));

  // Auto-hide advancing overlay when the next view is ready or on errors
  useEffect(() => {
    if (!advancing) return;

    // Any error should dismiss overlay (error UI is already handled elsewhere)
    if (fetchError || saveError) {
      setAdvancing(false);
      return;
    }

    const stepKeyNow = STEP_KEYS[currentStep];

    // While saving, keep overlay
    if (isSaving) return;

    // Results page: keep overlay until results finish loading
    if (currentStep === 7) {
      if (resultsLoading) return;
      // finished results loading
      setAdvancing(false);
      return;
    }

    // Question steps (1..6): keep until data for current step is loaded
    if (stepKeyNow) {
      const hasData = Boolean(stepData[currentStep]);
      if (isLoading || !hasData) return;
      setAdvancing(false);
      return;
    }

    // Intro step (unlikely as a target after advancing); safe fallback
    if (!isLoading) setAdvancing(false);
  }, [advancing, isSaving, isLoading, resultsLoading, fetchError, saveError, currentStep, stepData]);

  return (
    <div className="w-full mx-auto space-y-6">
      <Card className="p-0 overflow-hidden">
        <div className="bg-[#411e60] px-4 py-3 md:px-6 md:py-4">
          <ProgressSteps
            variant="minimal"
            steps={[...STEP_LABELS]}
            currentIndex={currentStep}
            labelPosition="below"
            onStepClick={
              lockResultsNav
                ? undefined
                : (i) => {
                    // Allow jumping backward only when the lock is disabled
                    if (i < currentStep) setCurrentStep(i);
                  }
            }
          />
        </div>
        <div className="p-6 md:p-8">
          {isLast ? (
            <div className="space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Radar */}
                <Card className="p-4 bg-white text-[#111827]">
                  <h2 className="text-lg font-semibold mb-3">Gráfico de Resultados</h2>
                  {resultsLoading && (
                    <p className="text-base text-[#3a3a3a]">Carregando resultados…</p>
                  )}
                  {!resultsLoading && resultsError && (
                    <p className="text-base text-red-700">{resultsError}</p>
                  )}
                  {!resultsLoading && !resultsError && resultsData && resultsData.length > 0 && (
                    <ResultsRadar data={resultsData} />
                  )}
                  {!resultsLoading && !resultsError && (!resultsData || resultsData.length === 0) && (
                    <p className="text-base text-[#3a3a3a]">Sem dados para exibir no momento.</p>
                  )}
                </Card>

                {/* Right: Unlock Index + per-section averages */}
                <Card className="p-4 bg-white text-[#111827]">
                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Unlock Index</h2>
                      <p className="text-sm text-[#6b7280]">Média geral (0–5)</p>
                    </div>
                    {generalAverage !== null ? (
                      <span className={`rounded-xl px-3 py-1.5 text-2xl font-semibold leading-none text-white ${bgClass(generalAverage)}`}>
                        {generalAverage.toFixed(1)}
                      </span>
                    ) : null}
                  </div>
                  {resultsLoading && (
                    <p className="text-base text-[#3a3a3a]">Carregando…</p>
                  )}
                  {!resultsLoading && resultsError && (
                    <p className="text-base text-red-700">{resultsError}</p>
                  )}
                  {!resultsLoading && !resultsError && orderedDims.length > 0 && (
                    <div className="space-y-3">
                      {orderedDims.map((d) => {
                        const val = typeof d.averageScore === "number" ? d.averageScore : Number(d.averageScore);
                        const shown = Number(val.toFixed(1));
                        const max = typeof d.maxScore === "number" ? d.maxScore : Number(d.maxScore);
                        return (
                          <div key={d.key} className="grid items-center gap-3 md:grid-cols-[1fr_minmax(120px,2fr)_auto]">
                            <span className="text-[#3a3a3a] font-medium">{d.title}</span>
                            <MicroBar value={val} max={max || 5} />
                            <ScorePill value={shown} />
                          </div>
                        );
                      })}
                      
                    </div>
                  )}
                  {!resultsLoading && !resultsError && orderedDims.length === 0 && (
                    <p className="text-base text-[#3a3a3a]">Sem dados para exibir no momento.</p>
                  )}
                </Card>
              </div>

              {/* Keep the existing conclusion copy below */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Conclusão</h3>
                <p className="text-base text-[#3a3a3a]">
                  Você concluiu seu assessment no Unlock Index com sucesso. Um especialista de negócios da nossa equipe entrará em contato para continuar a conversa.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{visibleTitle}</h2>
              {/* Subtle guidance for the scale (hidden on Início) */}
              {STEP_KEYS[currentStep] ? (
                <p className="text-sm text-[#6b7280]">
                  Escolha a opção de resposta que mais se alinha à realidade de sua operação.
                </p>
              ) : null}

              {/* Content for steps 1..6: questions */}
              {STEP_KEYS[currentStep] ? (
                <div className="space-y-4">
                  {isLoading && null}
                  {!isLoading && fetchError && (
                    <div className="space-y-2">
                      <p className="text-base text-red-700">Ocorreu um erro ao carregar as perguntas.</p>
                      <div>
                        <PrimaryButton
                          type="button"
                          onClick={() => {
                            // Force refetch by clearing cached error/loading for this step
                            setStepData((d) => ({ ...d, [currentStep]: undefined }));
                            setLoadError((e) => ({ ...e, [currentStep]: null }));
                            setLoadingStep((l) => ({ ...l, [currentStep]: false }));
                            // Trigger effect by setting loading false and data undefined
                            // No-op here; effect will refire on next render
                          }}
                        >
                          Tentar novamente
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                  {!isLoading && !fetchError && currentData && (
                    <div className="space-y-4">
                      {currentData.questions.map((q) => (
                        <div key={q.key} className="py-4 border-b border-[#eaeaea] last:border-b-0">
                          <div className="mb-3 text-base font-medium">{q.label}</div>
                          <div className="flex flex-wrap gap-2 md:gap-3">
                            {q.options.map((opt) => (
                              <label key={opt.value} className="group cursor-pointer select-none">
                                <input
                                  type="radio"
                                  name={`q-${q.key}`}
                                  value={opt.value}
                                  checked={currentAnswers[q.key] === opt.value}
                                  onChange={() => handleSelect(q.key, opt.value as AnswerValue)}
                                  className="sr-only peer"
                                />
                                <span
                                  className="inline-flex items-center justify-center rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-sm text-[#3a3a3a] transition focus:outline-none group-active:scale-95 peer-checked:border-[#3135ef] peer-checked:bg-[#3135ef] peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-[#3135ef] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white"
                                >
                                  {sanitizeOptionLabel(opt.label)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {saveError && (
                    <p className="text-sm text-red-700">{saveError}</p>
                  )}
                </div>
              ) : (
                // Intro content
                <div className="space-y-3">
                  <p className="text-base text-[#3a3a3a]">
                    Bem-vindo(a)! Este assessment vai nos ajudar a entender como sua operação de e-commerce funciona hoje — e identificar, junto com você, as oportunidades para elevar performance, eficiência e experiência do cliente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {(!isLast || !lockResultsNav) ? (
        <div className="flex items-center justify-between">
          <div>
            {!isFirst && (
              <PrimaryButton type="button" onClick={handleBack} aria-label="Voltar" className="transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]">
                Voltar
              </PrimaryButton>
            )}
          </div>
          <div>
            {!isLast && (
              <PrimaryButton
                type="button"
                onClick={handleNext}
                aria-label="Avançar"
                disabled={
                  isSaving ||
                  (Boolean(STEP_KEYS[currentStep]) && (!currentData || isLoading || !allAnswered))
                }
              >
                {isSaving ? "Salvando…" : "Avançar"}
              </PrimaryButton>
            )}
          </div>
        </div>
      ) : null}

      {/* Full-screen advancing overlay: appears immediately on Avançar */}
      {advancing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <UnlockLoader size={144} label="" on="dark" />
        </div>
      )}
    </div>
  );
}
