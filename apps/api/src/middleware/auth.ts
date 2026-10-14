import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { HttpError } from '../lib/http';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: '7d' });
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), config.jwtSecret);
    if (typeof payload === 'string' || !payload.sub) throw new Error('Malformed token');
    req.userId = payload.sub;
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
};

export function getUserId(req: Request): string {
  if (!req.userId) throw new HttpError(401, 'Unauthorized');
  return req.userId;
}
