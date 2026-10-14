import { createApp } from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { startImportWorker } from './worker/importWorker';

const server = createApp().listen(config.port, () => {
  console.log(`FinSight API listening on http://localhost:${config.port}`);
});

const stopWorker = config.runWorker ? startImportWorker(config.workerIntervalMs) : () => undefined;

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  stopWorker();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
