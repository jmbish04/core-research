/**
 * @fileoverview Research projects schema for deep research platform
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const researchProjects = sqliteTable("research_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["draft", "planning", "running", "completed", "failed"] })
    .default("draft")
    .notNull(),
  topic: text("topic"),
  tags: text("tags", { mode: "json" }).$type<string[]>(),
  interactionId: text("interaction_id"),
  lastEventId: text("last_event_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
