import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function loadDotenvIfPresent() {
  const files = ['.env.local', '.env.development.local'];
  for (const f of files) {
    try {
      const txt = await readFile(path.resolve(process.cwd(), f), 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i === -1) continue;
        const k = t.slice(0, i).trim();
        let v = t.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    } catch {}
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--password') out.password = argv[++i];
  }
  return out;
}

async function main() {
  await loadDotenvIfPresent();
  const { email, password } = parseArgs(process.argv);
  if (!email || !password) {
    console.error('Usage: node scripts/check-credentials.mjs --email <email> --password <password>');
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL || process.env.commercial_survey_DATABASE_URL || process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  const sql = neon(dbUrl);
  const rows = await sql`SELECT id, email, password_hash, role FROM users WHERE email = ${email} LIMIT 1`;
  if (!rows || rows.length === 0) {
    console.log('User not found');
    return;
  }
  const u = rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  console.log({ found: true, email: u.email, role: u.role, passwordMatches: ok, hashPrefix: String(u.password_hash).slice(0,4) });
}

main().catch((e) => { console.error(e); process.exit(1); });

