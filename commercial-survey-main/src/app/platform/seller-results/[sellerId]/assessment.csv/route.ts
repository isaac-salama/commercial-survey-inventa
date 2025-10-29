import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { withPlatformDb } from "@/db/client";
import { users, sellerAssessments } from "@/db/schema";
import { eq } from "drizzle-orm";

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

  const sellerRow = await withPlatformDb((db) =>
    db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, sellerIdNum))
      .limit(1)
  );
  const seller = sellerRow[0];
  if (!seller) return new NextResponse("Not found", { status: 404 });

  const assessRow = await withPlatformDb((db) =>
    db
      .select({ status: sellerAssessments.status, data: sellerAssessments.data, submittedAt: sellerAssessments.submittedAt, updatedAt: sellerAssessments.updatedAt })
      .from(sellerAssessments)
      .where(eq(sellerAssessments.sellerId, sellerIdNum))
      .limit(1)
  );

  const header = [
    "sellerId",
    "sellerEmail",
    "status",
    "submittedAt",
    "updatedAt",
    "solution",
    "venda_sul",
    "venda_sudeste",
    "venda_norte",
    "venda_nordeste",
    "venda_centro_oeste",
    "modelo_compra_e_venda",
    "modelo_filial",
    "modelo_remessa_armazem_geral",
    "volumeMensalPedidos",
    "itensPorPedido",
    "skus",
    "ticketMedio",
    "canais",
    "gmvFlagshipMensal",
    "gmvMarketplacesMensal",
    "mesesCoberturaEstoque",
    "perfilProduto",
    "pesoMedioKg",
    "dimensao_c",
    "dimensao_l",
    "dimensao_a",
    "reversaPercent",
    "projetosEspeciais",
    "comentarios",
  ];

  const lines: string[] = [];
  lines.push(header.join(","));

  if (!assessRow[0]) {
    // No assessment: output empty values after basic columns
    const row = [
      String(seller.id),
      csvEscape(seller.email),
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ];
    lines.push(row.join(","));
  } else {
    const a = assessRow[0] as {
      status: "draft" | "submitted";
      data: import("@/db/schema").SellerAssessmentData;
      submittedAt: Date | null;
      updatedAt: Date | null;
    };
    const d = a.data;
    const venda = d.vendaPorRegiao || {};
    const modelo = d.modeloFiscal || {};
    const dim = d.dimensoesCm || {};
    const row = [
      String(seller.id),
      csvEscape(seller.email),
      csvEscape(String(a.status ?? "")),
      csvEscape(a.submittedAt ? new Date(a.submittedAt as unknown as string).toISOString() : ""),
      csvEscape(a.updatedAt ? new Date(a.updatedAt as unknown as string).toISOString() : ""),
      csvEscape(String(d.solution ?? "")),
      String(venda.sul ?? ""),
      String(venda.sudeste ?? ""),
      String(venda.norte ?? ""),
      String(venda.nordeste ?? ""),
      String(venda.centroOeste ?? ""),
      String(Boolean(modelo.compraEVenda)),
      String(Boolean(modelo.filial)),
      String(Boolean(modelo.remessaArmazemGeral)),
      String(d.volumeMensalPedidos ?? ""),
      String(d.itensPorPedido ?? ""),
      String(d.skus ?? ""),
      String(d.ticketMedio ?? ""),
      csvEscape(String(d.canais ?? "")),
      String(d.gmvFlagshipMensal ?? ""),
      String(d.gmvMarketplacesMensal ?? ""),
      String(d.mesesCoberturaEstoque ?? ""),
      csvEscape(String(d.perfilProduto ?? "")),
      String(d.pesoMedioKg ?? ""),
      String(dim.c ?? ""),
      String(dim.l ?? ""),
      String(dim.a ?? ""),
      String(d.reversaPercent ?? ""),
      csvEscape(String(d.projetosEspeciais ?? "")),
      csvEscape(String(d.comentarios ?? "")),
    ];
    lines.push(row.join(","));
  }

  return new NextResponse(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=assessment-${seller.id}.csv`,
    },
  });
}

function csvEscape(s: string) {
  if (s == null) return "";
  const needs = /[",\n]/.test(s);
  return needs ? '"' + s.replace(/"/g, '""') + '"' : s;
}
