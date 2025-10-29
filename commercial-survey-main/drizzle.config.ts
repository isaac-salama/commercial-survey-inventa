import type { Config } from "drizzle-kit";
import { loadEnvConfig } from "@next/env";

// Load environment variables similar to Next.js runtime
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Check your .env.local or .env.development.local"
  );
}

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Use non-pooled URL for migrations
    url: databaseUrl,
  },
} satisfies Config;
