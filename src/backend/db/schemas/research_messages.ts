/**
 * @fileoverview Research messages schema for conversation history
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const researchMessages = sqliteTable('research_messages', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
