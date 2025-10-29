import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

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
      // ignore
    }
  }
}

async function main() {
  await loadDotenvIfPresent();

  const dbUrl = process.env.DATABASE_URL || process.env.commercial_survey_DATABASE_URL || process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set. Define it in environment or .env.local');
  }
  const sql = neon(dbUrl);

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  // Fetch all active questions
  const qRows = await sql`SELECT id FROM questions WHERE is_active = true`;
  let inserted = 0;
  let updated = 0;

  for (const r of qRows) {
    const qId = r.id;
    const [{ max_order }] = await sql`SELECT coalesce(max("order"), 0) AS max_order FROM question_options WHERE question_id = ${qId}`;
    const desiredOrder = Number(max_order) + 1;

    if (dryRun) {
      // Check if exists
      const exists = await sql`SELECT 1 FROM question_options WHERE question_id = ${qId} AND value = '0' LIMIT 1`;
      if (exists.length === 0) inserted++;
      else updated++;
      continue;
    }

    const rows = await sql`
      INSERT INTO question_options (question_id, value, label, "order", score, is_active)
      VALUES (${qId}, '0', 'Não sei informar', ${desiredOrder}, 0, true)
      ON CONFLICT (question_id, value) DO UPDATE
        SET label = EXCLUDED.label,
            score = EXCLUDED.score,
            is_active = true,
            "order" = GREATEST(question_options."order", EXCLUDED."order")
      RETURNING id
    `;
    if (rows && rows.length > 0) {
      // When an insert happens, Neon returns the inserted row; for update it returns updated row as well
      // We can't distinguish insert vs update reliably from RETURNING; count both and refine via an existence check
      // Do a quick check to classify
      const check = await sql`SELECT 1 FROM question_options WHERE question_id = ${qId} AND value = '0' AND "order" = ${desiredOrder} LIMIT 1`;
      if (check.length > 0) inserted++;
      else updated++;
    }
  }

  if (dryRun) {
    console.log(`[DRY RUN] Questions: ${qRows.length}. Would insert: ${inserted}, would update: ${updated}.`);
  } else {
    console.log(`Processed ${qRows.length} questions. Inserted/Upserted 'Não sei informar' for each.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

