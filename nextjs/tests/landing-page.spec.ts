import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('should display the app name and navigation links', async ({ page }) => {
    await page.goto('/');

    // Verify the page loaded with key content
    await expect(page).toHaveTitle(/NYR Bingo|Resolution/i);

    // Verify core feature text is visible
    await expect(page.getByText('Create & Share Resolutions')).toBeVisible();
    await expect(page.getByText('Form Bingo Teams')).toBeVisible();

    // Verify login/register links exist
    await expect(page.getByRole('link', { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /sign up|register|get started/i })).toBeVisible();
  });
});