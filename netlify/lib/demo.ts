import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { transactions, users } from '../../db/schema.js';

export const DEMO_EMAIL = 'demo@finsight.dev';
const DEMO_PASSWORD = 'demo12345';

type TxType = 'INCOME' | 'EXPENSE';

// Deterministic PRNG so every seed produces the same dataset.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Creates the demo account with 12 months of realistic B2B SaaS financials
 * the first time someone signs in with the demo credentials.
 */
export async function ensureDemoUser(): Promise<void> {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
  if (existing) return;

  const [user] = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, name: 'Demo Company', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) })
    .onConflictDoNothing()
    .returning();
  if (!user) return; // created concurrently

  const random = createRandom(42);
  const vary = (base: number, spread = 0.15) => Math.round(base * (1 - spread + random() * spread * 2) * 100);
  const now = new Date();
  const data: (typeof transactions.$inferInsert)[] = [];

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() - monthsAgo;
    const growth = 1 + (11 - monthsAgo) * 0.05;
    const add = (day: number, type: TxType, category: string, amountCents: number, description: string) => {
      const date = new Date(Date.UTC(year, month, day));
      if (date <= now) {
        data.push({ userId: user.id, date: date.toISOString().slice(0, 10), amountCents, type, category, description });
      }
    };

    // Revenue
    add(3, 'INCOME', 'Subscriptions', vary(21000 * growth, 0.05), 'Monthly SaaS subscriptions');
    add(12, 'INCOME', 'Consulting', vary(6500), 'Implementation services');
    add(20, 'INCOME', 'Subscriptions', vary(4200 * growth), 'Annual plan upgrades');
    if (monthsAgo % 3 === 0) add(27, 'INCOME', 'Partnerships', vary(5000, 0.3), 'Partner revenue share');

    // Expenses
    add(25, 'EXPENSE', 'Payroll', vary(14500, 0.03), 'Team salaries');
    add(5, 'EXPENSE', 'Cloud', vary(1800 * growth, 0.1), 'Cloud infrastructure');
    add(8, 'EXPENSE', 'Software', vary(650, 0.05), 'SaaS tools & licenses');
    add(1, 'EXPENSE', 'Office', vary(1200, 0.02), 'Coworking rent');
    // A marketing campaign in the latest month creates a visible spike for the insights demo.
    add(15, 'EXPENSE', 'Marketing', monthsAgo === 0 ? vary(7800, 0.05) : vary(2600), 'Ads & content');
    if (monthsAgo % 3 === 1) add(28, 'EXPENSE', 'Taxes', vary(3900, 0.1), 'Quarterly tax payment');
  }

  await db.insert(transactions).values(data);
}
