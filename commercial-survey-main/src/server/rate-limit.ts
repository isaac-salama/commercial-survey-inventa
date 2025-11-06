type Result = { allowed: true; remaining?: number } | { allowed: false; retryAfterSec?: number };

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

export async function rateLimit(key: string, limit = 5, windowSec = 60): Promise<Result> {
  if (!url || !token) return { allowed: true };
  try {
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `rl:${key}:${Math.floor(now / windowSec)}`;
    const resp = await fetch(`${url}/incr/${encodeURIComponent(windowKey)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const count = await resp.json();
    if (count > 1) {
      // set ttl on first increment
      await fetch(`${url}/expire/${encodeURIComponent(windowKey)}/${windowSec}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
    }
    if (count > limit) return { allowed: false, retryAfterSec: windowSec - (now % windowSec) };
    return { allowed: true, remaining: Math.max(0, limit - count) };
  } catch {
    return { allowed: true };
  }
}

