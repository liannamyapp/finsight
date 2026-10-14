import { PrismaClient } from '@prisma/client';

// A single shared client per process (connection pooling is handled by Prisma).
export const prisma = new PrismaClient();
