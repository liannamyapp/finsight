import type { ImportJob } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getUserId } from '../../middleware/auth';

const MAX_CSV_BYTES = 2 * 1024 * 1024;

const createBody = z.object({
  csv: z
    .string()
    .min(1)
    .refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_CSV_BYTES, { message: 'CSV must be 2 MB or smaller' }),
});

const toDto = (job: ImportJob) => ({
  id: job.id,
  status: job.status,
  totalRows: job.totalRows,
  importedRows: job.importedRows,
  errors: job.errors,
  createdAt: job.createdAt,
  finishedAt: job.finishedAt,
});

export const importsRouter = Router();

/** Enqueues a CSV import. Processing happens in the background worker. */
importsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { csv } = createBody.parse(req.body);
    const job = await prisma.importJob.create({ data: { userId: getUserId(req), payload: csv } });
    res.status(202).json(toDto(job));
  }),
);

importsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const jobs = await prisma.importJob.findMany({
      where: { userId: getUserId(req) },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(jobs.map(toDto));
  }),
);

importsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const job = await prisma.importJob.findFirst({ where: { id: req.params.id, userId: getUserId(req) } });
    if (!job) throw new HttpError(404, 'Import job not found');
    res.json(toDto(job));
  }),
);
