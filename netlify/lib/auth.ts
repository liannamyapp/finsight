import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { db } from '../../db/index.js';
import { appSettings } from '../../db/schema.js';
import { HttpError } from './http.js';

let cachedSecret: string | undefined;

/**
 * JWT signing secret. Uses JWT_SECRET when configured; otherwise a random secret
 * is generated once and persisted in the database so tokens survive cold starts.
 */
async function getJwtSecret(): Promise<string> {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  await db
    .insert(appSettings)
    .values({ key: 'jwt_secret', value: randomBytes(48).toString('hex') })
    .onConflictDoNothing();
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'jwt_secret'));
  cachedSecret = row.value;
  return cachedSecret;
}

export async function signToken(userId: string): Promise<string> {
  return jwt.sign({ sub: userId }, await getJwtSecret(), { expiresIn: '7d' });
}

export async function requireUserId(req: Request): Promise<string> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Unauthorized');
  try {
    const payload = jwt.verify(header.slice('Bearer '.length), await getJwtSecret());
    if (typeof payload === 'string' || !payload.sub) throw new Error('Malformed token');
    return payload.sub;
  } catch {
    throw new HttpError(401, 'Invalid or expired token');
  }
}
