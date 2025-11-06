import { headers } from "next/headers";

export async function verifyTurnstile(token: string | undefined): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // disabled
  if (!token) return false;
  try {
    const h = await headers();
    const remoteip = h.get("x-forwarded-for") || undefined;
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteip) form.append("remoteip", remoteip.split(",")[0].trim());
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
