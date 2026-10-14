import type { Config, Context } from '@netlify/functions';
import bcrypt from 'bcryptjs';
import { and, asc, count, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { buildSummary } from '../../apps/api/src/domain/analytics';
import { MAX_AMOUNT_CENTS, parseIsoDate } from '../../apps/api/src/domain/csv';
import { db } from '../../db/index.js';
import { importJobs, transactions, users } from '../../db/schema.js';
import { getAggregates } from '../lib/analytics.js';
import { requireUserId, signToken } from '../lib/auth.js';
import { DEMO_EMAIL, ensureDemoUser } from '../lib/demo.js';
import { dateRangeSchema, errorResponse, HttpError, json, queryObject, readJson } from '../lib/http.js';
import { processJob } from '../lib/imports.js';
import { generateInsights } from '../lib/insights.js';

const txType = z.enum(['INCOME', 'EXPENSE']);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
const registerSchema = loginSchema.extend({ name: z.string().trim().min(1).max(100) });

const listQuery = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: txType.optional(),
  category: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createTxBody = z.object({
  date: z.string().date(),
  amount: z.number().positive().max(MAX_AMOUNT_CENTS / 100),
  type: txType,
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).optional(),
});

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const createImportBody = z.object({
  csv: z
    .string()
    .min(1)
    .refine((s) => Buffer.byteLength(s, 'utf8') <= MAX_CSV_BYTES, { message: 'CSV must be 2 MB or smaller' }),
});

const publicUser = (u: { id: string; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name });

const txDto = (t: typeof transactions.$inferSelect) => ({
  id: t.id,
  date: t.date,
  amountCents: t.amountCents,
  type: t.type,
  category: t.category,
  description: t.description,
});

const jobDto = (job: typeof importJobs.$inferSelect) => ({
  id: job.id,
  status: job.status,
  totalRows: job.totalRows,
  importedRows: job.importedRows,
  errors: job.errors,
  createdAt: job.createdAt,
  finishedAt: job.finishedAt,
});

async function route(req: Request, context: Context): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, '').replace(/\/+$/, '') || '/';
  const method = req.method;
  const segments = path.split('/').filter(Boolean);

  // --- Auth -----------------------------------------------------------------
  if (path === '/auth/register' && method === 'POST') {
    const body = registerSchema.parse(await readJson(req));
    const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
    if (exists) throw new HttpError(409, 'Email is already registered');
    const [user] = await db
      .insert(users)
      .values({ email: body.email, name: body.name, passwordHash: await bcrypt.hash(body.password, 10) })
      .returning();
    return json({ token: await signToken(user.id), user: publicUser(user) }, 201);
  }

  if (path === '/auth/login' && method === 'POST') {
    const body = loginSchema.parse(await readJson(req));
    if (body.email === DEMO_EMAIL) await ensureDemoUser();
    const [user] = await db.select().from(users).where(eq(users.email, body.email));
    // Same error for unknown email and wrong password to avoid user enumeration.
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    return json({ token: await signToken(user.id), user: publicUser(user) });
  }

  if (path === '/health' && method === 'GET') return json({ status: 'ok' });

  // Everything below requires a valid token.
  const userId = await requireUserId(req);

  if (path === '/auth/me' && method === 'GET') {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new HttpError(404, 'User not found');
    return json(publicUser(user));
  }

  // --- Transactions -----------------------------------------------------------
  if (path === '/transactions' && method === 'GET') {
    const q = listQuery.parse(queryObject(url));
    const where = and(
      eq(transactions.userId, userId),
      q.type ? eq(transactions.type, q.type) : undefined,
      q.category ? eq(transactions.category, q.category) : undefined,
      q.from ? gte(transactions.date, q.from) : undefined,
      q.to ? lte(transactions.date, q.to) : undefined,
    );
    const [items, [{ total }]] = await Promise.all([
      db
        .select()
        .from(transactions)
        .where(where)
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .offset((q.page - 1) * q.pageSize)
        .limit(q.pageSize),
      db.select({ total: count() }).from(transactions).where(where),
    ]);
    return json({ items: items.map(txDto), total, page: q.page, pageSize: q.pageSize });
  }

  if (path === '/transactions/categories' && method === 'GET') {
    const rows = await db
      .selectDistinct({ category: transactions.category })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(asc(transactions.category));
    return json(rows.map((r) => r.category));
  }

  if (path === '/transactions' && method === 'POST') {
    const body = createTxBody.parse(await readJson(req));
    if (!parseIsoDate(body.date)) throw new HttpError(400, 'Invalid date');
    const [created] = await db
      .insert(transactions)
      .values({
        userId,
        date: body.date,
        amountCents: Math.round(body.amount * 100),
        type: body.type,
        category: body.category,
        description: body.description || null,
      })
      .returning();
    return json(txDto(created), 201);
  }

  if (segments[0] === 'transactions' && segments.length === 2 && method === 'DELETE') {
    // Scoped by userId so users can never delete each other's data.
    const deleted = await db
      .delete(transactions)
      .where(and(eq(transactions.id, segments[1]), eq(transactions.userId, userId)))
      .returning({ id: transactions.id });
    if (deleted.length === 0) throw new HttpError(404, 'Transaction not found');
    return new Response(null, { status: 204 });
  }

  // --- Analytics & insights ---------------------------------------------------
  if (path === '/analytics/summary' && method === 'GET') {
    const range = dateRangeSchema.parse(queryObject(url));
    return json(buildSummary(await getAggregates(userId, range)));
  }

  if (path === '/insights' && method === 'POST') {
    const range = dateRangeSchema.parse(await readJson(req));
    return json(await generateInsights(userId, range));
  }

  // --- CSV imports --------------------------------------------------------------
  if (path === '/imports' && method === 'POST') {
    const { csv } = createImportBody.parse(await readJson(req));
    const [job] = await db.insert(importJobs).values({ userId, payload: csv }).returning();
    // Processed after the response is sent; the UI polls the job for progress.
    context.waitUntil(processJob(job.id));
    return json(jobDto(job), 202);
  }

  if (path === '/imports' && method === 'GET') {
    const jobs = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.userId, userId))
      .orderBy(desc(importJobs.createdAt))
      .limit(10);
    return json(jobs.map(jobDto));
  }

  if (segments[0] === 'imports' && segments.length === 2 && method === 'GET') {
    const [job] = await db
      .select()
      .from(importJobs)
      .where(and(eq(importJobs.id, segments[1]), eq(importJobs.userId, userId)));
    if (!job) throw new HttpError(404, 'Import job not found');
    return json(jobDto(job));
  }

  throw new HttpError(404, 'Not found');
}

export default async (req: Request, context: Context) => {
  try {
    return await route(req, context);
  } catch (err) {
    return errorResponse(err);
  }
};

export const config: Config = {
  path: '/api/*',
};
