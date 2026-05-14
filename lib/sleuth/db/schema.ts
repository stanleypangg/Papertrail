import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const SLEUTH_WORLDS_TABLE = "sleuth_worlds";

export const worlds = sqliteTable(SLEUTH_WORLDS_TABLE, {
  script_id: text("script_id").primaryKey(),
  operation_id: text("operation_id"),
  splat_url: text("splat_url"),
  status: text("status", { enum: ["pending", "done", "error"] }),
  world_prompt_json: text("world_prompt_json"),
  created_at: integer("created_at", { mode: "timestamp" }),
  expires_at: integer("expires_at", { mode: "timestamp" }),
});

export type WorldRow = typeof worlds.$inferSelect;
export type NewWorldRow = typeof worlds.$inferInsert;
