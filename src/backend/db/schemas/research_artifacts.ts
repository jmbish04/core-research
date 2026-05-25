/**
 * @fileoverview Research artifacts schema for generated outputs
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const researchArtifacts = sqliteTable('research_artifacts', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  type: text('type', { enum: ['report', 'pwa', 'podcast', 'mindmap', 'dev_suite'] }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Stores raw text, markdown or JSON payload configurations
  publicUrl: text('public_url'),     // R2 URL or deployment endpoint if applicable
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
