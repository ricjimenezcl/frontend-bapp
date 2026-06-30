import { test, expect } from '@playwright/test';

/**
 * password-reset.spec.ts — frontend-bapp (mobile)
 * Flujo de recuperación de contraseña en mobile.
 */

test.describe('Recuperar contraseña Mobile', () => {
  test('página de recuperación carga correctamente', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(page.locator('ion-app, app-root')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/500|error/);
  });

  test('tiene input de email', async ({ page }) => {
    await page.goto('/auth/forgot-password');
    await expect(
      page.locator('input[type="email"], ion-input[type="email"]').first()
    ).toBeVisible({ timeout: 8_000 });
  });
});
