import { neon } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Lightweight .env loader (same approach as seed-from-csv)
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
    } catch (_) {
      // ignore missing files
    }
  }
}

async function main() {
  await loadDotenvIfPresent();
  const dbUrl = process.env.DATABASE_URL || process.env.commercial_survey_DATABASE_URL || process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set. Define it in environment or .env.local');
  const sql = neon(dbUrl);

  // Capitalize first character only when label starts with a lowercase letter
  // We use RETURNING to get affected row counts for logging
  const qRows = await sql`
    UPDATE questions
    SET label = upper(substr(label, 1, 1)) || substr(label, 2)
    WHERE label IS NOT NULL
      AND label <> ''
      AND substr(label, 1, 1) <> upper(substr(label, 1, 1))
    RETURNING id;
  `;

  const optRows = await sql`
    UPDATE question_options
    SET label = upper(substr(label, 1, 1)) || substr(label, 2)
    WHERE label IS NOT NULL
      AND label <> ''
      AND substr(label, 1, 1) <> upper(substr(label, 1, 1))
    RETURNING id;
  `;

  console.log(`Capitalized questions: ${qRows.length}`);
  console.log(`Capitalized options:   ${optRows.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

