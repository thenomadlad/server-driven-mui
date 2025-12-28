import { test, expect } from '@playwright/test';

// This test navigates to the root of the app and checks for a known text
// rendered by the HomePage component.

test('homepage renders hello alert and cards', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Hello 👋')).toBeVisible();
  await expect(page.getByText('This app uses the Next.js App Router and Material UI v5.')).toBeVisible();
  await expect(page.getByText('CMYK', { exact: true })).toBeVisible();
});

