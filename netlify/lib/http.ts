import { z, ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Optional ISO date range (YYYY-MM-DD) shared by analytics endpoints. */
export const dateRangeSchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: '`from` must be before `to`' });

export type DateRange = z.infer<typeof dateRangeSchema>;

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export async function readJson(req: Request, maxBytes = 3 * 1024 * 1024): Promise<unknown> {
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new HttpError(413, 'Payload too large');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Malformed JSON body');
  }
}

export const queryObject = (url: URL) => Object.fromEntries(url.searchParams.entries());

/** Centralized error mapping, mirroring the original Express error handler. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ZodError) return json({ error: 'ValidationError', details: err.flatten() }, 400);
  if (err instanceof HttpError) return json({ error: err.message, details: err.details }, err.status);
  console.error(err);
  return json({ error: 'InternalServerError' }, 500);
}
