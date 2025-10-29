"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PrimaryButton } from "@/components/primary-button";
import { Card } from "@/components/card";
import { setHomeCardVisibility } from "./actions";
import { UnlockLoader } from "@/components/unlock-loader";

type SellerRow = {
  id: number;
  email: string;
  lastLoginAt: Date | null;
  showIndex: boolean;
  showAssessment: boolean;
  reachedResultsAt: Date | null;
  indexAnswered: number;
  indexTotal: number;
  assessmentAnswered: number;
  assessmentTotal: number;
  assessmentStatus: "draft" | "submitted";
  assessmentSubmittedAt: Date | null;
};

type Props = {
  q: string;
  sellers: SellerRow[];
  nextCursor: string | null;
  limit: number;
};

export default function SellerTable({ q, sellers, nextCursor, limit }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);
  const [pending, start] = useTransition();
  const [navigating, setNavigating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [applyingFilter, setApplyingFilter] = useState(false);
  const [searching, setSearching] = useState(false);
  const [toggling, setToggling] = useState(false);

  const goToSeller = (sellerId: number) => {
    setNavigating(true);
    router.push(`/platform/seller-results/${sellerId}`);
  };
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, sellerId: number) => {
    if (e.defaultPrevented) return;
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === "button" || tag === "a" || (e.target as HTMLElement)?.closest("button, a")) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToSeller(sellerId);
    }
  };

  const firstPageHref = useMemo(() => {
    const p = new URLSearchParams(searchParams?.toString() || "");
    p.delete("cursor");
    if (search) p.set("q", search); else p.delete("q");
    p.set("limit", String(limit));
    return `?${p.toString()}`;
  }, [searchParams, search, limit]);

  const nextHref = useMemo(() => {
    if (!nextCursor) return null;
    const p = new URLSearchParams(searchParams?.toString() || "");
    p.set("cursor", nextCursor);
    if (search) p.set("q", search); else p.delete("q");
    p.set("limit", String(limit));
    return `?${p.toString()}`;
  }, [searchParams, nextCursor, search, limit]);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    start(() => {
      router.push(firstPageHref);
    });
  };

  // Debounced search
  useEffect(() => {
    if (search === q) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams?.toString() || "");
      p.delete("cursor");
      if (search) p.set("q", search); else p.delete("q");
      p.set("limit", String(limit));
      router.push(`?${p.toString()}`);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, q, router, searchParams, limit]);

  const fmt = (d: Date | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
  const fmtExact = (d: Date | null) => (d ? new Date(d).toLocaleString("pt-BR") : undefined);
  const fmtRelative = (d: Date | null): string => {
    if (!d) return "—";
    const now = new Date();
    const diffMs = now.getTime() - new Date(d).getTime();
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const hr = Math.floor(min / 60);
    const day = Math.floor(hr / 24);
    if (sec < 60) return `há ${sec}s`;
    if (min < 60) return `há ${min}m`;
    if (hr < 24) return `há ${hr}h`;
    return `há ${day}d`;
  };

  const cellPad = "px-3 py-2 text-sm";
  const headPad = "px-3 py-2";

  const highlight = (text: string, query: string) => {
    if (!query) return text;
    const i = text.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return text;
    const before = text.slice(0, i);
    const match = text.slice(i, i + query.length);
    const after = text.slice(i + query.length);
    return (
      <>
        {before}
        <mark className="bg-yellow-100 text-inherit rounded px-0.5">{match}</mark>
        {after}
      </>
    );
  };

  // Quick filters helpers
  const toggleParam = (key: string, next: string | undefined) => {
    const p = new URLSearchParams(searchParams?.toString() || "");
    p.delete("cursor");
    if (next === undefined) p.delete(key); else p.set(key, next);
    setApplyingFilter(true);
    start(() => {
      router.push(`?${p.toString()}`);
    });
  };
  const isOn = (key: string, val: string = "1") => (searchParams?.get(key) ?? undefined) === val;

  // Turn off filter overlay once transition completes
  useEffect(() => {
    if (!pending) {
      if (applyingFilter) setApplyingFilter(false);
      if (searching) setSearching(false);
      if (toggling) setToggling(false);
    }
  }, [pending]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={onSearchSubmit} className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar e-mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded border border-[#e5e7eb] px-3 py-2 text-sm"
          />
          <PrimaryButton type="submit" disabled={pending} className="transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98]">Buscar</PrimaryButton>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => toggleParam("fIndexDone", isOn("fIndexDone") ? undefined : "1")}
            aria-pressed={isOn("fIndexDone")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fIndexDone") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Index finalizado
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fAssessSent", isOn("fAssessSent", "1") ? undefined : "1")}
            aria-pressed={isOn("fAssessSent", "1")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fAssessSent", "1") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Assessment enviado
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fStale30", isOn("fStale30") ? undefined : "1")}
            aria-pressed={isOn("fStale30")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fStale30") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Sem acesso &gt; 30d
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fIndexVisible", isOn("fIndexVisible", "1") ? undefined : "1")}
            aria-pressed={isOn("fIndexVisible", "1")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fIndexVisible", "1") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Index visível
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fIndexVisible", isOn("fIndexVisible", "0") ? undefined : "0")}
            aria-pressed={isOn("fIndexVisible", "0")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fIndexVisible", "0") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Index oculto
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fAssessVisible", isOn("fAssessVisible", "1") ? undefined : "1")}
            aria-pressed={isOn("fAssessVisible", "1")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fAssessVisible", "1") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Assessment visível
          </button>
          <button
            type="button"
            onClick={() => toggleParam("fAssessVisible", isOn("fAssessVisible", "0") ? undefined : "0")}
            aria-pressed={isOn("fAssessVisible", "0")}
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] hover:shadow-sm ${isOn("fAssessVisible", "0") ? "bg-[#3135ef] text-white border-[#3135ef]" : "border-[#e5e7eb]"}`}
          >
            Assessment oculto
          </button>
        </div>
      </Card>

      <Card className="p-4 overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-white text-[#3135ef] font-bold text-left sticky top-0 z-20">
              <th className={`font-bold whitespace-nowrap sticky left-0 z-30 bg-white ${headPad}`}>Email</th>
              <th className={`font-bold whitespace-nowrap text-center ${headPad}`}>Último acesso</th>
              <th className={`font-bold whitespace-nowrap ${headPad}`}>Index — Visibilidade</th>
              <th className={`font-bold whitespace-nowrap text-center ${headPad}`}>Index — Progresso</th>
              <th className={`font-bold whitespace-nowrap ${headPad}`}>Assessment — Visibilidade</th>
              <th className={`font-bold whitespace-nowrap text-center ${headPad}`}>Assessment — Status</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((u) => (
              <tr
                key={u.id}
                className="group border-t hover:bg-[#f5f7ff] cursor-pointer focus:bg-[#eef2ff] outline-none"
                onClick={() => goToSeller(u.id)}
                onKeyDown={(e) => handleRowKeyDown(e, u.id)}
                aria-label={`Ver detalhes do seller ${u.email}`}
              >
                <td className={`align-top sticky left-0 bg-white group-hover:bg-[#f5f7ff] ${cellPad}`}>{highlight(u.email, search)}</td>
                <td className={`align-top whitespace-nowrap text-center ${cellPad}`} title={fmtExact(u.lastLoginAt)}>{fmtRelative(u.lastLoginAt)}</td>

                <td className={`align-top text-center ${cellPad}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToggling(true);
                      start(async () => {
                        await setHomeCardVisibility({ sellerId: u.id, card: 1, visible: !u.showIndex });
                        router.refresh();
                      });
                    }}
                    aria-label={u.showIndex ? "Ocultar Index para o seller" : "Mostrar Index para o seller"}
                    title={u.showIndex ? "Ocultar Index" : "Mostrar Index"}
                    className={`inline-flex items-center justify-center rounded border border-[#e5e7eb] bg-white hover:bg-[#f5f7ff] px-2 py-1 transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] cursor-pointer ${u.showIndex ? "text-green-500" : "text-red-400"}`}
                    disabled={pending}
                    aria-pressed={u.showIndex}
                  >
                    {u.showIndex ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.29 20.29 0 0 1 5.06-5.94"/>
                        <path d="M1 1l22 22"/>
                      </svg>
                    )}
                  </button>
                </td>

                <td className={`align-top whitespace-nowrap text-center ${cellPad}`}>
                  {(() => {
                    const prefix = u.indexTotal === 0 ? "🔴" : u.indexAnswered === 0 ? "🔴" : u.indexAnswered === u.indexTotal ? "🟢" : "🟠";
                    const finished = Boolean(u.reachedResultsAt);
                    const dt = u.reachedResultsAt ? new Date(u.reachedResultsAt) : null;
                    const date = dt ? dt.toLocaleDateString("pt-BR") : "";
                    const time = dt ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";
                    return (
                      <div className="space-y-0.5">
                        <div>{`${prefix} ${u.indexAnswered}/${u.indexTotal}`}</div>
                        {finished && (
                          <div className="text-[#6b7280] text-xs leading-tight">
                            <div>Finalizado em:</div>
                            <div>{date}</div>
                            <div>{time}</div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>

                <td className={`align-top text-center ${cellPad}`}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setToggling(true);
                      start(async () => {
                        await setHomeCardVisibility({ sellerId: u.id, card: 2, visible: !u.showAssessment });
                        router.refresh();
                      });
                    }}
                    aria-label={u.showAssessment ? "Ocultar Assessment para o seller" : "Mostrar Assessment para o seller"}
                    title={u.showAssessment ? "Ocultar Assessment" : "Mostrar Assessment"}
                    className={`inline-flex items-center justify-center rounded border border-[#e5e7eb] bg-white hover:bg-[#f5f7ff] px-2 py-1 transition-transform duration-150 hover:scale-[1.04] active:scale-[0.98] cursor-pointer ${u.showAssessment ? "text-green-500" : "text-red-400"}`}
                    disabled={pending}
                    aria-pressed={u.showAssessment}
                  >
                    {u.showAssessment ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.29 20.29 0 0 1 5.06-5.94"/>
                        <path d="M1 1l22 22"/>
                      </svg>
                    )}
                  </button>
                </td>

                <td className={`align-top text-center ${cellPad}`}>
                  {(() => {
                    const statusEmoji = u.assessmentAnswered === 0 ? "🔴" : u.assessmentAnswered < u.assessmentTotal ? "🟠" : "🟢";
                    const statusText = u.assessmentAnswered === 0 ? "Não iniciado" : u.assessmentAnswered < u.assessmentTotal ? "Em andamento" : "Concluído";
                    const submitted = u.assessmentStatus === "submitted";
                    const dt = u.assessmentSubmittedAt ? new Date(u.assessmentSubmittedAt) : null;
                    const date = dt ? dt.toLocaleDateString("pt-BR") : null;
                    const time = dt ? dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;
                    return (
                      <div className="space-y-0.5">
                        <div>{`${statusEmoji} ${statusText}`}</div>
                        <div className="text-[#6b7280] text-xs">Perguntas respondidas: {u.assessmentAnswered}/{u.assessmentTotal}</div>
                        <div className="text-[#6b7280] text-xs">
                          {submitted ? (
                            <>
                              <span>Enviado: Sim — </span>
                              <span>{date}</span>
                              <span> — {time}</span>
                            </>
                          ) : (
                            "Enviado: Não"
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-[#6b7280]" colSpan={6}>Nenhum Seller encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <a className="underline text-[#3135ef]" href={firstPageHref}>Primeira página</a>
          {nextHref ? (
            <a className="underline text-[#3135ef]" href={nextHref}>Próxima</a>
          ) : (
            <span className="text-[#6b7280]">Fim</span>
          )}
        </div>
      </div>

      {/* Loading overlay for filters/search/toggles */}
      {pending && (applyingFilter || searching || toggling) && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40">
          <UnlockLoader
            size={120}
            label={toggling ? "Atualizando visibilidade…" : applyingFilter ? "Aplicando filtro…" : "Buscando…"}
            on="dark"
          />
        </div>
      )}

      {navigating && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <UnlockLoader size={144} label="Abrindo vendedor…" on="dark" />
        </div>
      )}
    </div>
  );
}
