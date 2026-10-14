import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

/** Forwards rejected promises from async route handlers to the Express error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Optional ISO date range (YYYY-MM-DD) shared by analytics endpoints. */
export const dateRangeSchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((r) => !r.from || !r.to || r.from <= r.to, { message: '`from` must be before `to`' });

export type DateRange = z.infer<typeof dateRangeSchema>;
