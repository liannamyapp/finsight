import { Prisma } from '@prisma/client';
import type { AggRow, TxType } from '../../domain/analytics';
import { parseIsoDate } from '../../domain/csv';
import type { DateRange } from '../../lib/http';
import { prisma } from '../../lib/prisma';

type RawRow = { month: string; type: TxType; category: string; total: bigint };

/**
 * Aggregates transactions in PostgreSQL (GROUP BY month, type, category).
 * Uses the (userId, date) index and returns at most months x categories rows,
 * no matter how many transactions the user has.
 */
export async function getAggregates(userId: string, range: DateRange): Promise<AggRow[]> {
  const conditions = [Prisma.sql`"userId" = ${userId}`];
  const from = range.from ? parseIsoDate(range.from) : null;
  const to = range.to ? parseIsoDate(range.to) : null;
  if (from) conditions.push(Prisma.sql`"date" >= ${from}`);
  if (to) conditions.push(Prisma.sql`"date" <= ${to}`);

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT to_char(date_trunc('month', "date"), 'YYYY-MM') AS month,
           "type"::text AS type,
           "category",
           SUM("amountCents")::bigint AS total
    FROM "Transaction"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY 1, 2, 3
    ORDER BY 1`;

  return rows.map((r) => ({ month: r.month, type: r.type, category: r.category, totalCents: Number(r.total) }));
}
