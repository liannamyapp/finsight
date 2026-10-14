import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const transactionType = pgEnum('transaction_type', ['INCOME', 'EXPENSE']);
export const importStatus = pgEnum('import_status', ['PENDING', 'PROCESSING', 'DONE', 'FAILED']);

const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const users = pgTable('users', {
  id: id(),
  email: text().notNull().unique(),
  name: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Money is stored as integer cents to avoid floating-point rounding errors. */
export const transactions = pgTable(
  'transactions',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date({ mode: 'string' }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    type: transactionType().notNull(),
    category: text().notNull(),
    description: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // Covers the main access paths: list by period and aggregate by type/category.
  (t) => [
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_user_type_category_idx').on(t.userId, t.type, t.category),
  ],
);

/** CSV imports are processed asynchronously (DB-backed queue). */
export const importJobs = pgTable(
  'import_jobs',
  {
    id: id(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: importStatus().notNull().default('PENDING'),
    payload: text().notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    errors: jsonb().$type<{ line: number; message: string }[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('import_jobs_status_created_idx').on(t.status, t.createdAt),
    index('import_jobs_user_created_idx').on(t.userId, t.createdAt),
  ],
);

/** Server-side key/value settings (e.g. the generated JWT signing secret). */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});
