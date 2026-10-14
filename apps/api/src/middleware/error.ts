import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/http';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'ValidationError', details: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  // Body-parser errors (malformed JSON, payload too large) carry a status code.
  const status = typeof err?.status === 'number' ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'InternalServerError' : err.message });
};
