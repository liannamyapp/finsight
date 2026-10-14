import { expect, test } from '@playwright/test';

/** Requires the full stack with demo data (docker compose up). */
test.describe('FinSight', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('demo@finsight.dev');
    await page.getByLabel('Password').fill('demo12345');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows KPIs, charts and generates insights', async ({ page }) => {
    await expect(page.getByText('Net profit')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue vs. expenses' })).toBeVisible();

    await page.getByRole('button', { name: 'Generate insights' }).click();
    await expect(page.locator('.insight').first()).toBeVisible();
  });

  test('adds a transaction and sees it in the history', async ({ page }) => {
    const description = `E2E test ${Date.now()}`;
    await page.getByRole('link', { name: 'Transactions' }).click();

    await page.getByLabel('Amount, USD').fill('123.45');
    await page.getByLabel('Category', { exact: true }).fill('Testing');
    await page.getByLabel('Description').fill(description);
    await page.getByRole('button', { name: 'Add transaction' }).click();

    await expect(page.getByRole('cell', { name: description })).toBeVisible();
  });

  test('imports a CSV file in the background', async ({ page }) => {
    await page.getByRole('link', { name: 'Transactions' }).click();
    const csv = 'date,amount,type,category,description\n2026-01-10,500,INCOME,Consulting,E2E import\nbad,1,INCOME,X,\n';

    await page.locator('input[type="file"]').setInputFiles({
      name: 'import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    const status = page.getByTestId('import-status');
    await expect(status).toContainText('DONE', { timeout: 15_000 });
    await expect(status).toContainText('1 row(s) skipped');
  });
});
