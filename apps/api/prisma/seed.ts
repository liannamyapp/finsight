/**
 * Seeds a demo account with 12 months of realistic B2B SaaS financials.
 * Login: demo@finsight.dev / demo12345
 */
import { PrismaClient, type TransactionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Deterministic PRNG so every seed produces the same dataset.
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

type SeedTx = {
  userId: string;
  date: Date;
  amountCents: number;
  type: TransactionType;
  category: string;
  description: string;
};

async function main() {
  const email = 'demo@finsight.dev';
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: 'Demo Company', passwordHash: await bcrypt.hash('demo12345', 10) },
  });

  if ((await prisma.transaction.count({ where: { userId: user.id } })) > 0) {
    console.log('Demo data already exists, skipping');
    return;
  }

  const random = createRandom(42);
  const vary = (base: number, spread = 0.15) => Math.round(base * (1 - spread + random() * spread * 2) * 100);
  const now = new Date();
  const data: SeedTx[] = [];

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() - monthsAgo;
    const growth = 1 + (11 - monthsAgo) * 0.05;
    const add = (day: number, type: TransactionType, category: string, amountCents: number, description: string) => {
      const date = new Date(Date.UTC(year, month, day));
      if (date <= now) data.push({ userId: user.id, date, amountCents, type, category, description });
    };

    // Revenue
    add(3, 'INCOME', 'Subscriptions', vary(21000 * growth, 0.05), 'Monthly SaaS subscriptions');
    add(12, 'INCOME', 'Consulting', vary(6500), 'Implementation services');
    add(20, 'INCOME', 'Subscriptions', vary(4200 * growth), 'Annual plan upgrades');
    if (monthsAgo % 3 === 0) add(27, 'INCOME', 'Partnerships', vary(5000, 0.3), 'Partner revenue share');

    // Expenses
    add(25, 'EXPENSE', 'Payroll', vary(14500, 0.03), 'Team salaries');
    add(5, 'EXPENSE', 'Cloud', vary(1800 * growth, 0.1), 'GCP infrastructure');
    add(8, 'EXPENSE', 'Software', vary(650, 0.05), 'SaaS tools & licenses');
    add(1, 'EXPENSE', 'Office', vary(1200, 0.02), 'Coworking rent');
    // A marketing campaign in the latest month creates a visible spike for the insights demo.
    add(15, 'EXPENSE', 'Marketing', monthsAgo === 0 ? vary(7800, 0.05) : vary(2600), 'Ads & content');
    if (monthsAgo % 3 === 1) add(28, 'EXPENSE', 'Taxes', vary(3900, 0.1), 'Quarterly tax payment');
  }

  await prisma.transaction.createMany({ data });
  console.log(`Seeded ${data.length} transactions for ${email}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
