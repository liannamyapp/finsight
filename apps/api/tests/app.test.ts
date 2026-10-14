/**
 * HTTP-level tests for routing, auth and validation.
 * They never reach the database: every request here is rejected by
 * middleware or validation before a query would be executed.
 */
import request from 'supertest';
import { createApp } from '../src/app';
import { signToken } from '../src/middleware/auth';

const app = createApp();

describe('API', () => {
  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it.each(['/api/transactions', '/api/analytics/summary', '/api/imports'])('protects %s with auth', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/transactions').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('validates registration payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nope', password: '123', name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
    expect(Object.keys(res.body.details.fieldErrors)).toEqual(expect.arrayContaining(['email', 'password', 'name']));
  });

  it('validates query params on authorized requests', async () => {
    const token = signToken('user-1');
    const res = await request(app)
      .get('/api/analytics/summary?from=2026-05-01&to=2026-01-01')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('validates new transactions before touching the database', async () => {
    const token = signToken('user-1');
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-13-01', amount: -5, type: 'GIFT', category: '' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details.fieldErrors)).toEqual(
      expect.arrayContaining(['date', 'amount', 'type', 'category']),
    );
  });

  it('returns 400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
  });
});
