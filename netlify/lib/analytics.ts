import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { AggRow } from '../../apps/api/src/domain/analytics';
import { db } from '../../db/index.js';
import { transactions } from '../../db/schema.js';
import type { DateRange } from './http.js';

const month = sql<string>`to_char(date_trunc('month', ${transactions.date}), 'YYYY-MM')`;

/**
 * Aggregates transactions in PostgreSQL (GROUP BY month, type, category).
 * Uses the (user_id, date) index and returns at most months x categories rows,
 * no matter how many transactions the user has.
 */
export async function getAggregates(userId: string, range: DateRange): Promise<AggRow[]> {
  const rows = await db
    .select({
      month,
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`sum(${transactions.amountCents})::bigint`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        range.from ? gte(transactions.date, range.from) : undefined,
        range.to ? lte(transactions.date, range.to) : undefined,
      ),
    )
    .groupBy(month, transactions.type, transactions.category)
    .orderBy(month);

  return rows.map((r) => ({ month: r.month, type: r.type, category: r.category, totalCents: Number(r.total) }));
}
