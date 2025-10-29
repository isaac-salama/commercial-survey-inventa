import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

// Lightweight .env loader (no deps). Loads .env.local and .env.development.local if present.
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

function slugify(input) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function capitalizeFirst(s) {
  if (!s) return s;
  return s[0].toLocaleUpperCase() + s.slice(1);
}

function parseCSV(text) {
  // Returns array of objects keyed by headers
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^\uFEFF/, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    if (fields.length === 0 || fields.every(f => f.trim() === '')) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (fields[j] ?? '').trim();
    }
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function upsertStep(sql, { key, title, order }) {
  const rows = await sql`
    INSERT INTO survey_steps ("key", title, description, "order", is_active)
    VALUES (${key}, ${title}, ${null}, ${order}, true)
    ON CONFLICT ("key") DO UPDATE
      SET title = EXCLUDED.title,
          description = EXCLUDED.description,
          "order" = EXCLUDED."order",
          is_active = true
    RETURNING id;
  `;
  return rows[0].id;
}

async function upsertQuestion(sql, { key, label }) {
  const rows = await sql`
    INSERT INTO questions ("key", label, help_text, is_active)
    VALUES (${key}, ${capitalizeFirst(label)}, ${null}, true)
    ON CONFLICT ("key") DO UPDATE
      SET label = EXCLUDED.label,
          help_text = EXCLUDED.help_text,
          is_active = true
    RETURNING id;
  `;
  return rows[0].id;
}

async function upsertOption(sql, { questionId, value, label, order, score }) {
  const rows = await sql`
    INSERT INTO question_options (question_id, value, label, "order", score, is_active)
    VALUES (${questionId}, ${value}, ${capitalizeFirst(label)}, ${order}, ${score}, true)
    ON CONFLICT (question_id, value) DO UPDATE
      SET label = EXCLUDED.label,
          "order" = EXCLUDED."order",
          score = EXCLUDED.score,
          is_active = true
    RETURNING id;
  `;
  return rows[0].id;
}

async function upsertStepQuestion(sql, { stepId, questionId, order }) {
  await sql`
    INSERT INTO step_questions (step_id, question_id, "order", required)
    VALUES (${stepId}, ${questionId}, ${order}, true)
    ON CONFLICT (step_id, question_id) DO UPDATE
      SET "order" = EXCLUDED."order",
          required = EXCLUDED.required;
  `;
}

async function main() {
  await loadDotenvIfPresent();

  const dbUrl = process.env.DATABASE_URL || process.env.commercial_survey_DATABASE_URL || process.env.COMMERCIAL_SURVEY_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set. Define it in environment or .env.local');
  }
  const sql = neon(dbUrl);

  // Step order mapping (fixed):
  const orderedDimensions = ['Payments', 'Warehouse', 'Delivery', 'CX', 'Analytics', 'Organização'];
  const stepOrderMap = new Map(orderedDimensions.map((d, i) => [d, i + 1]));

  const csvPath = process.argv[2] || path.resolve(process.cwd(), 'temp_working_files/Copy of Unlock Index  - Unlock Index.csv');
  const raw = await readFile(csvPath, 'utf8');
  const rows = parseCSV(raw);

  // Group questions by dimensão preserving CSV order
  const grouped = new Map();
  for (const row of rows) {
    const dim = (row['Dimensão'] || '').trim();
    if (!dim) continue;
    if (!grouped.has(dim)) grouped.set(dim, []);
    grouped.get(dim).push(row);
  }

  // Create steps (upsert) in predefined order
  const stepIds = new Map(); // key -> id
  for (const dim of orderedDimensions) {
    const order = stepOrderMap.get(dim);
    const key = slugify(dim);
    const id = await upsertStep(sql, { key, title: dim, order });
    stepIds.set(dim, { id, key, order });
  }

  // Walk each dimension and seed questions/options
  for (const dim of orderedDimensions) {
    const items = grouped.get(dim) || [];
    const { id: stepId, key: stepKey } = stepIds.get(dim);
    let qOrder = 1;
    for (const row of items) {
      const pergunta = (row['Pergunta'] || '').trim();
      if (!pergunta) continue;

      const qKey = `${stepKey}-${String(qOrder).padStart(2, '0')}`;
      const questionId = await upsertQuestion(sql, { key: qKey, label: pergunta });

      // Options: Nível 1 (score 1), Nível 3 (score 3), Nível 5 (score 5) + "Não sei informar" (score 0)
      const optDefs = [
        { value: '1', label: (row['Nível 1'] || '').trim(), order: 1, score: 1 },
        { value: '3', label: (row['Nível 3'] || '').trim(), order: 2, score: 3 },
        { value: '5', label: (row['Nível 5'] || '').trim(), order: 3, score: 5 },
        { value: '0', label: 'Não sei informar', order: 4, score: 0 },
      ];

      for (const opt of optDefs) {
        if (!opt.label) {
          throw new Error(`Missing option label for question ${qKey} (${dim}) with value ${opt.value}`);
        }
        await upsertOption(sql, { questionId, ...opt });
      }

      await upsertStepQuestion(sql, { stepId, questionId, order: qOrder });
      qOrder++;
    }
  }

  console.log('CSV seeding complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
