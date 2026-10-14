import type { Config } from '@netlify/functions';
import { processPendingJobs } from '../lib/imports.js';

/** Safety net: picks up any CSV import jobs left pending (e.g. if inline processing was cut short). */
export default async () => {
  const processed = await processPendingJobs();
  if (processed) console.log(`Processed ${processed} pending import job(s)`);
};

export const config: Config = {
  schedule: '* * * * *',
};
