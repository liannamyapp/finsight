import type { Prisma } from '@prisma/client';
import { parseTransactionsCsv } from '../domain/csv';
import { prisma } from '../lib/prisma';

const BATCH_SIZE = 500;
const MAX_STORED_ERRORS = 50;

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * Claims and processes one pending import job.
 * The claim is an atomic conditional UPDATE (status PENDING -> PROCESSING),
 * so several worker instances can run in parallel without double-processing.
 * Returns true if a job was found (so the caller can loop until the queue is empty).
 */
export async function processNextJob(): Promise<boolean> {
  const job = await prisma.importJob.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return false;

  const claimed = await prisma.importJob.updateMany({
    where: { id: job.id, status: 'PENDING' },
    data: { status: 'PROCESSING', startedAt: new Date() },
  });
  if (claimed.count === 0) return true; // another worker took it

  try {
    const { rows, errors } = parseTransactionsCsv(job.payload);
    await prisma.importJob.update({ where: { id: job.id }, data: { totalRows: rows.length + errors.length } });

    let imported = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, userId: job.userId }));
      await prisma.transaction.createMany({ data: batch });
      imported += batch.length;
      await prisma.importJob.update({ where: { id: job.id }, data: { importedRows: imported } });
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: rows.length === 0 && errors.length > 0 ? 'FAILED' : 'DONE',
        importedRows: imported,
        errors: errors.length ? asJson(errors.slice(0, MAX_STORED_ERRORS)) : undefined,
        payload: '', // raw CSV is no longer needed
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    console.error(`Import job ${job.id} failed`, err);
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errors: asJson([{ line: 0, message: 'Unexpected error while importing' }]),
        finishedAt: new Date(),
      },
    });
  }
  return true;
}

/** Polls the queue on an interval. Returns a stop function for graceful shutdown. */
export function startImportWorker(intervalMs: number): () => void {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      while (await processNextJob()) {
        /* drain the queue */
      }
    } catch (err) {
      console.error('Import worker error', err);
    } finally {
      busy = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
