import type { Prisma, Transaction } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { MAX_AMOUNT_CENTS, parseIsoDate } from '../../domain/csv';
import { asyncHandler, HttpError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getUserId } from '../../middleware/auth';

const txType = z.enum(['INCOME', 'EXPENSE']);

const listQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: txType.optional(),
  category: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createBody = z.object({
  date: z.string().date(),
  amount: z.number().positive().max(MAX_AMOUNT_CENTS / 100),
  type: txType,
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
});

export const toDto = (t: Transaction) => ({
  id: t.id,
  date: t.date.toISOString().slice(0, 10),
  amountCents: t.amountCents,
  type: t.type,
  category: t.category,
  description: t.description,
});

export const transactionsRouter = Router();

transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where: Prisma.TransactionWhereInput = {
      userId: getUserId(req),
      type: q.type,
      category: q.category || undefined,
      date: q.from || q.to ? { gte: q.from ? parseIsoDate(q.from)! : undefined, lte: q.to ? parseIsoDate(q.to)! : undefined } : undefined,
    };

    const [items, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ items: items.map(toDto), total, page: q.page, pageSize: q.pageSize });
  }),
);

transactionsRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const rows = await prisma.transaction.findMany({
      where: { userId: getUserId(req) },
      distinct: ['category'],
      select: { category: true },
      orderBy: { category: 'asc' },
    });
    res.json(rows.map((r) => r.category));
  }),
);

transactionsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createBody.parse(req.body);
    const date = parseIsoDate(body.date);
    if (!date) throw new HttpError(400, 'Invalid date');

    const created = await prisma.transaction.create({
      data: {
        userId: getUserId(req),
        date,
        amountCents: Math.round(body.amount * 100),
        type: body.type,
        category: body.category,
        description: body.description || null,
      },
    });
    res.status(201).json(toDto(created));
  }),
);

transactionsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // Scoped by userId so users can never delete each other's data.
    const result = await prisma.transaction.deleteMany({ where: { id: req.params.id, userId: getUserId(req) } });
    if (result.count === 0) throw new HttpError(404, 'Transaction not found');
    res.status(204).end();
  }),
);
