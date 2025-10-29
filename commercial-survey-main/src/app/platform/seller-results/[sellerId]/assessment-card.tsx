"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/card";
import type { SellerAssessmentData } from "@/db/schema";

type Assess = {
  status: "draft" | "submitted";
  data: SellerAssessmentData;
  submittedAt: string | Date | null;
  updatedAt: string | Date | null;
} | null;

type Props = { assessment: Assess; sellerId: number };

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleString("pt-BR");
  } catch {
    return String(d);
  }
}

const solutionLabel = (s?: SellerAssessmentData["solution"]) =>
  s === "unlock_full_service"
    ? "Payments + Warehouse + Shipping + CX (SAC)"
    : s === "unlock_response"
    ? "Payments + Warehouse + Shipping"
    : s === "unlock_fulfillment"
    ? "Warehouse + Shipping"
    : "—";

export default function AssessmentCard({ assessment, sellerId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const status = assessment?.status ?? null;
  const data = assessment?.data ?? null;

  const numericHighlights = useMemo(() => {
    const d = data;
    return [
      { label: "Pedidos/mês", value: d?.volumeMensalPedidos },
      { label: "Itens por pedido", value: d?.itensPorPedido },
      { label: "SKUs", value: d?.skus },
      { label: "Ticket médio (R$)", value: d?.ticketMedio },
      { label: "GMV Flagship (R$)", value: d?.gmvFlagshipMensal },
      { label: "GMV Marketplaces (R$)", value: d?.gmvMarketplacesMensal },
      { label: "Meses de cobertura", value: d?.mesesCoberturaEstoque },
      { label: "Peso médio (kg)", value: d?.pesoMedioKg },
      { label: "Reversa (%)", value: d?.reversaPercent },
    ];
  }, [data]);

  return (
    <Card className="p-4 bg-white text-[#111827]">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Assessment</h2>
          <p className="text-sm text-[#6b7280]">Resumo de informações</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium text-white ${
              status === "submitted" ? "bg-green-600" : status === "draft" ? "bg-amber-500" : "bg-gray-400"
            }`}
          >
            {status ? (status === "submitted" ? "Enviado" : "Rascunho") : "Sem assessment"}
          </span>
          {status === "submitted" && (
            <span className="text-sm text-[#6b7280]">{fmtDate(assessment?.submittedAt ?? null)}</span>
          )}
        </div>
      </div>

      {/* Summary */}
      {data ? (
        <div className="space-y-4">
          <div>
            <div className="text-sm text-[#6b7280]">Solução</div>
            <div className="font-medium">{solutionLabel(data.solution)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {numericHighlights.map((h) => (
              <div key={h.label} className="rounded-xl border border-[#e5e7eb] p-3">
                <div className="text-xs text-[#6b7280]">{h.label}</div>
                <div className="text-base font-medium">{h.value ?? "—"}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <div className="text-xs text-[#6b7280] mb-2">Venda por Região (R$/mês)</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-[#6b7280]">Sul:</span> {data.vendaPorRegiao?.sul ?? "—"}</div>
                <div><span className="text-[#6b7280]">Sudeste:</span> {data.vendaPorRegiao?.sudeste ?? "—"}</div>
                <div><span className="text-[#6b7280]">Norte:</span> {data.vendaPorRegiao?.norte ?? "—"}</div>
                <div><span className="text-[#6b7280]">Nordeste:</span> {data.vendaPorRegiao?.nordeste ?? "—"}</div>
                <div><span className="text-[#6b7280]">Centro-Oeste:</span> {data.vendaPorRegiao?.centroOeste ?? "—"}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <div className="text-xs text-[#6b7280] mb-2">Modelo Fiscal</div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${data.modeloFiscal?.compraEVenda ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}>Compra e venda</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${data.modeloFiscal?.filial ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}>Filial</span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 border ${data.modeloFiscal?.remessaArmazemGeral ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}>Remessa armazém geral</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <div className="text-xs text-[#6b7280]">Canais</div>
              <div className="text-base">{data.canais || "—"}</div>
            </div>
            <div className="rounded-xl border border-[#e5e7eb] p-3">
              <div className="text-xs text-[#6b7280]">Perfil de produto</div>
              <div className="text-base">{data.perfilProduto || "—"}</div>
            </div>
          </div>

          <div className="rounded-xl border border-[#e5e7eb] p-3">
            <div className="text-xs text-[#6b7280]">Dimensões médias (cm)</div>
            <div className="text-base">C: {data.dimensoesCm?.c ?? "—"} · L: {data.dimensoesCm?.l ?? "—"} · A: {data.dimensoesCm?.a ?? "—"}</div>
          </div>
        </div>
      ) : (
        <p className="text-base text-[#3a3a3a]">Sem assessment.</p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          className="text-sm underline text-[#3135ef]"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="assessment-details"
        >
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
        <a
          href={`/platform/seller-results/${sellerId}/assessment.csv`}
          className="inline-flex items-center justify-center rounded-xl bg-[#B8F4F7] px-4 py-2 text-sm text-[#2A2AE6] transition-colors"
          download
        >
          Baixar CSV
        </a>
      </div>

      {expanded && data && (
        <div id="assessment-details" className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="1. Solução desejada" value={solutionLabel(data.solution)} />
            <Field label="2. Venda por Região (R$/mês)" value={
              `Sul: ${data.vendaPorRegiao?.sul ?? "—"} | Sudeste: ${data.vendaPorRegiao?.sudeste ?? "—"} | Norte: ${data.vendaPorRegiao?.norte ?? "—"} | Nordeste: ${data.vendaPorRegiao?.nordeste ?? "—"} | Centro-Oeste: ${data.vendaPorRegiao?.centroOeste ?? "—"}`
            } />
            <Field label="3. Modelo fiscal" value={
              [
                data.modeloFiscal?.compraEVenda ? "Compra e venda" : null,
                data.modeloFiscal?.filial ? "Filial" : null,
                data.modeloFiscal?.remessaArmazemGeral ? "Remessa armazém geral" : null,
              ].filter(Boolean).join(", ") || "—"
            } />
            <Field label="4. Volume mensal de pedidos" value={data.volumeMensalPedidos ?? "—"} />
            <Field label="5. Itens por pedido" value={data.itensPorPedido ?? "—"} />
            <Field label="6. SKUs" value={data.skus ?? "—"} />
            <Field label="7. Ticket médio (R$)" value={data.ticketMedio ?? "—"} />
            <Field label="8. Canais" value={data.canais ?? "—"} />
            <Field label="9. GMV Flagship (R$)" value={data.gmvFlagshipMensal ?? "—"} />
            <Field label="10. GMV Marketplaces (R$)" value={data.gmvMarketplacesMensal ?? "—"} />
            <Field label="11. Meses de cobertura de estoque" value={data.mesesCoberturaEstoque ?? "—"} />
            <Field label="12. Perfil de produto" value={data.perfilProduto ?? "—"} />
            <Field label="13. Peso médio (kg)" value={data.pesoMedioKg ?? "—"} />
            <Field label="14. Dimensões (cm)" value={`C: ${data.dimensoesCm?.c ?? "—"} · L: ${data.dimensoesCm?.l ?? "—"} · A: ${data.dimensoesCm?.a ?? "—"}`} />
            <Field label="15. Reversa (%)" value={data.reversaPercent ?? "—"} />
            <Field label="16. Projetos especiais" value={data.projetosEspeciais ?? "—"} />
            <Field label="17. Comentários" value={data.comentarios ?? "—"} />
          </div>
          <div className="text-xs text-[#6b7280]">Atualizado em: {fmtDate(assessment?.updatedAt ?? null)}</div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#e5e7eb] p-3">
      <div className="text-[#6b7280]">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
