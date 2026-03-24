import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const whitelist = sqliteTable('whitelist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
