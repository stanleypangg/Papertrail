import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/sleuth/db/schema.ts",
  out: "./drizzle/sleuth",
  dialect: "sqlite",
  dbCredentials: {
    url: "sleuth.db",
  },
} satisfies Config;
