// Use loose typing for SMTP transport to avoid extra type packages in runtime build
type SMTPTransport = unknown;
type MinimalTransport = { sendMail: (opts: { from: string; to: string; subject: string; html: string }) => Promise<unknown> };
type NodemailerLike = { createTransport: (opts: { host: string; port: number; secure: boolean; auth: { user: string; pass: string } }) => MinimalTransport };

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

async function trySmtpSend({ from, to, subject, html }: Required<SendEmailParams>): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) return false;
  const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true" || port === 465;
  // Dynamic import with minimal typing (avoid dev type deps in runtime build)
  const nodemailer = (await import("nodemailer")) as unknown as NodemailerLike;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  await transport.sendMail({ from, to, subject, html });
  return true;
}

async function tryResendSend({ from, to, subject, html }: Required<SendEmailParams>): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({ from, to, subject, html });
  return true;
}

export async function sendEmail(params: SendEmailParams): Promise<{ ok: boolean; provider: "smtp" | "resend" | "none" }> {
  const from = params.from || process.env.EMAIL_FROM || "Inventa <no-reply@inventa.shop>";
  const payload = { from, to: params.to, subject: params.subject, html: params.html } as Required<SendEmailParams>;

  // 1) Prefer SMTP if configured (e.g., Gmail Workspace with App Password)
  try {
    if (await trySmtpSend(payload)) return { ok: true, provider: "smtp" };
  } catch (e) {
    console.warn("[EMAIL] SMTP provider failed, trying fallback", (e as Error)?.message || e);
  }

  // 2) Fallback to Resend if configured
  try {
    if (await tryResendSend(payload)) return { ok: true, provider: "resend" };
  } catch (e) {
    console.warn("[EMAIL] Resend provider failed", (e as Error)?.message || e);
  }

  // 3) Dev/log fallback only (no actual send)
  console.info("[EMAIL:DEV:NO_PROVIDER]", { from, to: params.to, subject: params.subject });
  return { ok: false, provider: "none" };
}
