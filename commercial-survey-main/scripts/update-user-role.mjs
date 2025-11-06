import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

async function loadDotenvIfPresent() {
  const candidates = ['.env.local', '.env.development.local'];
  for (const file of candidates) {
    try {
      const content = await readFile(path.resolve(process.cwd(), file), 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = value;
      }
    } catch (_) {}
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--role') out.role = argv[++i];
  }
  return out;
}

async function main() {
  await loadDotenvIfPresent();
  const { email, role } = parseArgs(process.argv);
  if (!email || !role || !['platform', 'seller'].includes(role)) {
    console.error('Usage: node scripts/update-user-role.mjs --email <email> --role <platform|seller>');
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL || process.env.commercial_survey_DATABASE_URL || process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set');
  const sql = neon(dbUrl);
  const now = new Date().toISOString();
  const res = await sql`UPDATE users SET role=${role}, updated_at=${now} WHERE email=${email} RETURNING id`;
  if (!res || res.length === 0) {
    console.error('User not found:', email);
    process.exit(1);
  }
  console.log('Updated role', { email, role });
}

main().catch((err) => { console.error(err); process.exit(1); });

