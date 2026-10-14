import { and, asc, eq } from 'drizzle-orm';
import { parseTransactionsCsv } from '../../apps/api/src/domain/csv';
import { db } from '../../db/index.js';
import { importJobs, transactions } from '../../db/schema.js';

const BATCH_SIZE = 500;
const MAX_STORED_ERRORS = 50;

/**
 * Claims and processes one import job. The claim is an atomic conditional UPDATE
 * (status PENDING -> PROCESSING), so concurrent invocations never double-process a job.
 */
export async function processJob(jobId: string): Promise<void> {
  const [job] = await db
    .update(importJobs)
    .set({ status: 'PROCESSING', startedAt: new Date() })
    .where(and(eq(importJobs.id, jobId), eq(importJobs.status, 'PENDING')))
    .returning();
  if (!job) return; // already taken by another invocation

  try {
    const { rows, errors } = parseTransactionsCsv(job.payload);
    await db.update(importJobs).set({ totalRows: rows.length + errors.length }).where(eq(importJobs.id, job.id));

    let imported = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({
        ...r,
        date: r.date.toISOString().slice(0, 10),
        userId: job.userId,
      }));
      await db.insert(transactions).values(batch);
      imported += batch.length;
      await db.update(importJobs).set({ importedRows: imported }).where(eq(importJobs.id, job.id));
    }

    await db
      .update(importJobs)
      .set({
        status: rows.length === 0 && errors.length > 0 ? 'FAILED' : 'DONE',
        importedRows: imported,
        errors: errors.length ? errors.slice(0, MAX_STORED_ERRORS) : null,
        payload: '', // raw CSV is no longer needed
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));
  } catch (err) {
    console.error(`Import job ${job.id} failed`, err);
    await db
      .update(importJobs)
      .set({
        status: 'FAILED',
        errors: [{ line: 0, message: 'Unexpected error while importing' }],
        finishedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));
  }
}

/** Drains any pending jobs (safety net for jobs whose inline processing was interrupted). */
export async function processPendingJobs(): Promise<number> {
  const pending = await db
    .select({ id: importJobs.id })
    .from(importJobs)
    .where(eq(importJobs.status, 'PENDING'))
    .orderBy(asc(importJobs.createdAt))
    .limit(20);
  for (const { id } of pending) await processJob(id);
  return pending.length;
}
