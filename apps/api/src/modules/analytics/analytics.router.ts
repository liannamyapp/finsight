import { Router } from 'express';
import { buildSummary } from '../../domain/analytics';
import { asyncHandler, dateRangeSchema } from '../../lib/http';
import { getUserId } from '../../middleware/auth';
import { getAggregates } from './analytics.service';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const range = dateRangeSchema.parse(req.query);
    const rows = await getAggregates(getUserId(req), range);
    res.json(buildSummary(rows));
  }),
);
