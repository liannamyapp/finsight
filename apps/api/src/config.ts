import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5',
  runWorker: process.env.RUN_WORKER !== 'false',
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 2000),
};
