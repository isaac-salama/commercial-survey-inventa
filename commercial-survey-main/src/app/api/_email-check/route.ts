import { sendEmail } from "@/server/email";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") || process.env.SMTP_USER || "";
  if (!to) return NextResponse.json({ ok: false, message: "missing recipient" }, { status: 400 });

  // Require an authenticated session to avoid abuse
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });

  try {
    const res = await sendEmail({
      to,
      subject: "Inventa — teste de e-mail",
      html: "<p>Teste de e-mail do sistema Inventa.</p>",
    });
    return NextResponse.json({ ok: res.ok, provider: res.provider, to });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message || String(e) }, { status: 500 });
  }
}

