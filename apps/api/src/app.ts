import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { HttpError } from './lib/http';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { authRouter } from './modules/auth/auth.router';
import { importsRouter } from './modules/imports/imports.router';
import { insightsRouter } from './modules/insights/insights.router';
import { transactionsRouter } from './modules/transactions/transactions.router';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '3mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/transactions', requireAuth, transactionsRouter);
  app.use('/api/analytics', requireAuth, analyticsRouter);
  app.use('/api/imports', requireAuth, importsRouter);
  app.use('/api/insights', requireAuth, insightsRouter);

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorHandler);

  return app;
}
