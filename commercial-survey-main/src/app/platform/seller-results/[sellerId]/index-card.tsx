"use client";

import { useMemo, useState } from "react";
import ResultsRadar from "@/components/results-radar";
import { Card } from "@/components/card";

type RadarDatum = { label: string; value: number; max: number };

type Section = {
  stepId: number;
  title: string;
  order: number;
  subtotal: number;
  maxSubtotal: number;
  items: { question: string; answer: string; score: number }[];
};

type Props = {
  radarData: RadarDatum[];
  dims: { title: string; order: number; average: number; max: number }[];
  generalAverage: number | null;
  sections: Section[];
  sellerId: number;
};

export default function IndexCard({ radarData, dims, generalAverage, sections, sellerId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const ordered = useMemo(() => [...dims].sort((a, b) => a.order - b.order), [dims]);

  const bgClass = (value: number) =>
    value >= 4.0 ? "bg-green-600" : value <= 1.5 ? "bg-red-600" : "bg-amber-500";

  const ScorePill: React.FC<{ value: number; className?: string }> = ({ value, className }) => (
    <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-medium text-white ${bgClass(value)} ${className || ""}`}>
      {value.toFixed(1)}
    </span>
  );

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

  const csvHref = `/platform/seller-results/${sellerId}/answers.csv`;

  return (
    <Card className="p-4 bg-white text-[#111827]">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inventa Index</h2>
          <p className="text-sm text-[#6b7280]">Média geral (0–5)</p>
        </div>
        {generalAverage !== null ? (
          <span className={`rounded-xl px-3 py-1.5 text-2xl font-semibold leading-none text-white ${bgClass(generalAverage || 0)}`}>
            {(generalAverage || 0).toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {radarData && radarData.length > 0 ? (
            <ResultsRadar data={radarData} />
          ) : (
            <p className="text-base text-[#3a3a3a]">Sem dados para exibir no momento.</p>
          )}
        </div>
        <div className="space-y-3">
          {ordered.map((d) => {
            const shown = Number((d.average ?? 0).toFixed(1));
            return (
              <div key={d.title} className="grid items-center gap-3 md:grid-cols-[1fr_minmax(120px,2fr)_auto]">
                <span className="text-[#3a3a3a] font-medium">{d.title}</span>
                <MicroBar value={shown} max={d.max || 5} />
                <ScorePill value={shown} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          className="text-sm underline text-[#3135ef]"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="index-details"
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
        <a
          href={csvHref}
          className="inline-flex items-center justify-center rounded-xl bg-[#B8F4F7] px-4 py-2 text-sm text-[#2A2AE6] transition-colors"
          download
        >
          Baixar CSV
        </a>
      </div>

      {expanded && (
        <div id="index-details" className="mt-4 space-y-4">
          {sections.map((sec) => (
            <Card key={sec.stepId} className="p-4 bg-white text-[#111827]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">{sec.title}</h3>
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
      )}
    </Card>
  );
}
