"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Card } from "@/components/card";
import { PrimaryButton } from "@/components/primary-button";
import {
  getAssessment,
  saveAssessmentDraft,
  submitAssessment,
} from "./actions";
import type { SellerAssessmentData } from "@/db/schema";

type Draft = SellerAssessmentData;

type VendaKey = keyof NonNullable<Draft["vendaPorRegiao"]>;
type ModeloKey = keyof NonNullable<Draft["modeloFiscal"]>;
type DimensaoKey = keyof NonNullable<Draft["dimensoesCm"]>;

const initialDraft: Draft = {
  solution: undefined,
  vendaPorRegiao: { sul: undefined, sudeste: undefined, norte: undefined, nordeste: undefined, centroOeste: undefined },
  modeloFiscal: { compraEVenda: false, filial: false, remessaArmazemGeral: false },
  volumeMensalPedidos: undefined,
  itensPorPedido: undefined,
  skus: undefined,
  ticketMedio: undefined,
  canais: "",
  gmvFlagshipMensal: undefined,
  gmvMarketplacesMensal: undefined,
  mesesCoberturaEstoque: undefined,
  perfilProduto: "",
  pesoMedioKg: undefined,
  dimensoesCm: { c: undefined, l: undefined, a: undefined },
  reversaPercent: undefined,
  projetosEspeciais: "",
  comentarios: "",
};

export default function AssessmentForm() {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "submitted" | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAssessment()
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.message || "Erro ao carregar assessment");
          return;
        }
        const d = res.data?.data;
        const st = res.data?.status ?? null;
        if (st) setStatus(st);
        if (d) {
          // Shallow merge to preserve all fields
          setDraft((prev) => ({ ...prev, ...d, vendaPorRegiao: { ...prev.vendaPorRegiao, ...d.vendaPorRegiao }, modeloFiscal: { ...prev.modeloFiscal, ...d.modeloFiscal }, dimensoesCm: { ...prev.dimensoesCm, ...d.dimensoesCm } }));
        }
      })
      .catch(() => !cancelled && setError("Erro ao carregar assessment"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function setNested(path: ["vendaPorRegiao", VendaKey], value: number | undefined): void;
  function setNested(path: ["modeloFiscal", ModeloKey], value: boolean): void;
  function setNested(path: ["dimensoesCm", DimensaoKey], value: number | undefined): void;
  function setNested(
    path: ["vendaPorRegiao" | "modeloFiscal" | "dimensoesCm", string],
    value: number | boolean | undefined
  ) {
    setDraft((d) => {
      if (path[0] === "vendaPorRegiao") {
        const key = path[1] as VendaKey;
        const prev = d.vendaPorRegiao ?? {};
        return { ...d, vendaPorRegiao: { ...prev, [key]: value as number | undefined } };
      }
      if (path[0] === "modeloFiscal") {
        const key = path[1] as ModeloKey;
        const prev = d.modeloFiscal ?? {};
        return { ...d, modeloFiscal: { ...prev, [key]: Boolean(value) } };
      }
      const key = path[1] as DimensaoKey;
      const prev = d.dimensoesCm ?? {};
      return { ...d, dimensoesCm: { ...prev, [key]: value as number | undefined } };
    });
  }

  const readOnly = status === "submitted";

  const isValidForSubmit = useMemo(() => {
    const data = draft;
    if (!data.solution) return false;
    const v = (data.vendaPorRegiao ?? {}) as Partial<NonNullable<Draft["vendaPorRegiao"]>>;
    const regions: Array<keyof NonNullable<Draft["vendaPorRegiao"]>> = ["sul", "sudeste", "norte", "nordeste", "centroOeste"];
    for (const r of regions) {
      const n = v[r];
      if (!(typeof n === "number" && Number.isFinite(n) && n >= 0)) return false;
    }
    const mf = data.modeloFiscal || {};
    if (!mf.compraEVenda && !mf.filial && !mf.remessaArmazemGeral) return false;
    const requiredNums: Array<keyof Draft> = [
      "volumeMensalPedidos",
      "itensPorPedido",
      "skus",
      "ticketMedio",
      "gmvFlagshipMensal",
      "gmvMarketplacesMensal",
      "mesesCoberturaEstoque",
      "pesoMedioKg",
      "reversaPercent",
    ];
    for (const k of requiredNums) {
      const n = draft[k] as unknown as number | undefined;
      if (!(typeof n === "number" && Number.isFinite(n) && n >= 0)) return false;
    }
    if (!draft.canais || !String(draft.canais).trim()) return false;
    if (!draft.perfilProduto || !String(draft.perfilProduto).trim()) return false;
    const d = draft.dimensoesCm || {};
    if (!(typeof d.c === "number" && d.c >= 0 && typeof d.l === "number" && d.l >= 0 && typeof d.a === "number" && d.a >= 0)) return false;
    const p = draft.reversaPercent as number | undefined;
    if (!(typeof p === "number" && p >= 0 && p <= 100)) return false;
    return true;
  }, [draft]);

  const handleSaveDraft = () => {
    if (readOnly) return;
    setSuccess(null);
    setError(null);
    startSaving(async () => {
      const res = await saveAssessmentDraft({ data: draft });
      if (!res.ok) {
        setError(res.message || "Erro ao salvar rascunho");
      } else {
        setSuccess("Rascunho salvo");
      }
    });
  };

  const handleSubmit = () => {
    if (readOnly) return;
    setSuccess(null);
    setError(null);
    startSubmitting(async () => {
      const res = await submitAssessment({ data: draft });
      if (!res.ok) {
        setError(res.message || "Erro ao enviar assessment");
      } else {
        setSuccess("Assessment enviado com sucesso");
        setStatus("submitted");
      }
    });
  };

  const numInput = (value: number | undefined, onChange: (n: number | undefined) => void, props?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="number"
      inputMode="decimal"
      value={value ?? ""}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? undefined : Number(v));
      }}
      className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[#111827]"
      disabled={readOnly}
      {...props}
    />
  );

  const moneyInputProps = { step: 0.1, placeholder: "R$ ..." } as const;

  if (loading) return null;

  return (
    <div className="space-y-4">
      {readOnly && (
        <Card className="p-4 bg-white text-[#111827]">
          <div className="text-sm">
            Assessment enviado. As respostas estão em modo somente leitura.
          </div>
        </Card>
      )}
      {/* 1 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">1. Quais soluções deseja contratar? *</div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="solution" checked={draft.solution === "unlock_full_service"} onChange={() => setField("solution", "unlock_full_service")} disabled={readOnly} />
            <span>Payments + Warehouse + Shipping + CX (SAC)</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="solution" checked={draft.solution === "unlock_response"} onChange={() => setField("solution", "unlock_response")} disabled={readOnly} />
            <span>Payments + Warehouse + Shipping</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="solution" checked={draft.solution === "unlock_fulfillment"} onChange={() => setField("solution", "unlock_fulfillment")} disabled={readOnly} />
            <span>Warehouse + Shipping</span>
          </label>
        </div>
      </Card>

      {/* 2 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">2. Venda por Região (R$/mês) *</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-sm">
            <span>Sul</span>
            {numInput(draft.vendaPorRegiao?.sul as number | undefined, (n) => setNested(["vendaPorRegiao", "sul"], n), { ...moneyInputProps, placeholder: "R$/mês" })}
          </label>
          <label className="block text-sm">
            <span>Sudeste</span>
            {numInput(draft.vendaPorRegiao?.sudeste as number | undefined, (n) => setNested(["vendaPorRegiao", "sudeste"], n), { ...moneyInputProps, placeholder: "R$/mês" })}
          </label>
          <label className="block text-sm">
            <span>Norte</span>
            {numInput(draft.vendaPorRegiao?.norte as number | undefined, (n) => setNested(["vendaPorRegiao", "norte"], n), { ...moneyInputProps, placeholder: "R$/mês" })}
          </label>
          <label className="block text-sm">
            <span>Nordeste</span>
            {numInput(draft.vendaPorRegiao?.nordeste as number | undefined, (n) => setNested(["vendaPorRegiao", "nordeste"], n), { ...moneyInputProps, placeholder: "R$/mês" })}
          </label>
          <label className="block text-sm">
            <span>Centro-Oeste</span>
            {numInput(draft.vendaPorRegiao?.centroOeste as number | undefined, (n) => setNested(["vendaPorRegiao", "centroOeste"], n), { ...moneyInputProps, placeholder: "R$/mês" })}
          </label>
        </div>
      </Card>

      {/* 3 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">3. Modelo fiscal desejável? *</div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!draft.modeloFiscal?.compraEVenda} onChange={(e) => setNested(["modeloFiscal", "compraEVenda"], e.target.checked)} disabled={readOnly} />
            <span>Compra e venda</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!draft.modeloFiscal?.filial} onChange={(e) => setNested(["modeloFiscal", "filial"], e.target.checked)} disabled={readOnly} />
            <span>Filial</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={!!draft.modeloFiscal?.remessaArmazemGeral} onChange={(e) => setNested(["modeloFiscal", "remessaArmazemGeral"], e.target.checked)} disabled={readOnly} />
            <span>Remessa armazém geral</span>
          </label>
        </div>
      </Card>

      {/* 4 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">4. Volume mensal de pedidos *</div>
        {numInput(draft.volumeMensalPedidos, (n) => setField("volumeMensalPedidos", n), { placeholder: "pedidos / mês" })}
      </Card>

      {/* 5 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">5. Número médio de itens por pedido *</div>
        {numInput(draft.itensPorPedido, (n) => setField("itensPorPedido", n), { placeholder: "itens / pedido" })}
      </Card>

      {/* 6 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">6. Quantidade de SKUs no seu catálogo *</div>
        {numInput(draft.skus, (n) => setField("skus", n))}
      </Card>

      {/* 7 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">7. Ticket médio por pedido (R$) *</div>
        {numInput(draft.ticketMedio, (n) => setField("ticketMedio", n), moneyInputProps)}
      </Card>

      {/* 8 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">8. Canais de vendas a serem ativados *</div>
        <input
          type="text"
          value={draft.canais ?? ""}
          onChange={(e) => setField("canais", e.target.value)}
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[#111827]"
          placeholder="Ex.: Flagship e-commerce da marca, Mercado Livre, Amazon, Magalú, TikTok Shop…"
          disabled={readOnly}
        />
      </Card>

      {/* 9 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">9. Expectativa de GMV Flagship (R$/mês) *</div>
        {numInput(draft.gmvFlagshipMensal, (n) => setField("gmvFlagshipMensal", n), moneyInputProps)}
      </Card>

      {/* 10 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">10. Expectativa de GMV Marketplaces (R$/mês) *</div>
        {numInput(draft.gmvMarketplacesMensal, (n) => setField("gmvMarketplacesMensal", n), moneyInputProps)}
      </Card>

      {/* 11 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">11. Quantidade de meses desejado para Cobertura de Estoque *</div>
        {numInput(draft.mesesCoberturaEstoque, (n) => setField("mesesCoberturaEstoque", n))}
      </Card>

      {/* 12 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">12. Descrição do perfil de Produto *</div>
        <textarea
          value={draft.perfilProduto ?? ""}
          onChange={(e) => setField("perfilProduto", e.target.value)}
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[#111827] min-h-[90px]"
          placeholder="Descreva o tipo de produtos que você vende"
          disabled={readOnly}
        />
      </Card>

      {/* 13 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">13. Peso médio por item (kg) *</div>
        {numInput(draft.pesoMedioKg, (n) => setField("pesoMedioKg", n), { placeholder: "kg" })}
      </Card>

      {/* 14 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">14. Dimensão média dos itens (cm) *</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-sm">
            <span>Comprimento (C)</span>
            {numInput(draft.dimensoesCm?.c, (n) => setNested(["dimensoesCm", "c"], n), { placeholder: "cm" })}
          </label>
          <label className="block text-sm">
            <span>Largura (L)</span>
            {numInput(draft.dimensoesCm?.l, (n) => setNested(["dimensoesCm", "l"], n), { placeholder: "cm" })}
          </label>
          <label className="block text-sm">
            <span>Altura (A)</span>
            {numInput(draft.dimensoesCm?.a, (n) => setNested(["dimensoesCm", "a"], n), { placeholder: "cm" })}
          </label>
        </div>
      </Card>

      {/* 15 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">15. % de pedidos com necessidade de logística reversa (devoluções) *</div>
        {numInput(draft.reversaPercent, (n) => setField("reversaPercent", n), { placeholder: "% (0–100)", step: 0.1 })}
      </Card>

      {/* 16 */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">16. Existem projetos especiais a serem considerados para o curto e médio prazo? *</div>
        <textarea
          value={draft.projetosEspeciais ?? ""}
          onChange={(e) => setField("projetosEspeciais", e.target.value)}
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[#111827] min-h-[90px]"
          placeholder="Descreva os projetos"
          disabled={readOnly}
        />
      </Card>

      {/* 17 (opcional) */}
      <Card className="p-4 bg-white text-[#111827]">
        <div className="mb-3 text-lg font-semibold text-[#3135ef]">17. Comentários adicionais (opcional)</div>
        <textarea
          value={draft.comentarios ?? ""}
          onChange={(e) => setField("comentarios", e.target.value)}
          className="w-full rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-[#111827] min-h-[90px]"
          placeholder="Comentários adicionais"
          disabled={readOnly}
        />
      </Card>

      {error && <p className="text-sm text-red-200">{error}</p>}
      {success && <p className="text-sm text-green-200">{success}</p>}

      <div className="flex items-center justify-end gap-3">
        <PrimaryButton type="button" onClick={handleSaveDraft} disabled={isSaving || loading || readOnly} aria-label="Salvar rascunho">
          {isSaving ? "Salvando…" : "Salvar rascunho"}
        </PrimaryButton>
        <PrimaryButton type="button" onClick={handleSubmit} disabled={isSubmitting || !isValidForSubmit || readOnly} aria-label="Enviar assessment">
          {isSubmitting ? "Enviando…" : "Enviar"}
        </PrimaryButton>
      </div>
    </div>
  );
}
