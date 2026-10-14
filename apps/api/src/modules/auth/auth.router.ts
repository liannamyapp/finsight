import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, HttpError } from '../../lib/http';
import { prisma } from '../../lib/prisma';
import { getUserId, requireAuth, signToken } from '../../middleware/auth';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(100),
});
const registerSchema = loginSchema.extend({ name: z.string().trim().min(1).max(100) });

const publicUser = (u: { id: string; email: string; name: string }) => ({ id: u.id, email: u.email, name: u.name });

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new HttpError(409, 'Email is already registered');

    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, passwordHash: await bcrypt.hash(body.password, 10) },
    });
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    // Same error for unknown email and wrong password to avoid user enumeration.
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    res.json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: getUserId(req) } });
    if (!user) throw new HttpError(404, 'User not found');
    res.json(publicUser(user));
  }),
);
