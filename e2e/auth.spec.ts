import { test, expect } from '@playwright/test';

/**
 * auth.spec.ts — frontend-bapp (mobile)
 * Flujos de autenticación en emulación de dispositivos móviles.
 */

test.describe('Autenticación Mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('carga la app sin pantalla en blanco', async ({ page }) => {
    await expect(page.locator('app-root, ion-app')).toBeVisible({ timeout: 10_000 });
  });

  test('muestra login o home según sesión', async ({ page }) => {
    const url = page.url();
    // Debe estar en login, home, o tabs — nunca en error
    expect(url).toMatch(/login|home|tabs|auth/);
  });

  test('formulario de login visible', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('ion-app, app-root')).toBeVisible();
    // El formulario de login debe tener inputs
    const inputs = page.locator('input[type="email"], input[type="text"], ion-input');
    await expect(inputs.first()).toBeVisible({ timeout: 8_000 });
  });

  test('flujo registro cliente accesible', async ({ page }) => {
    await page.goto('/auth/register-client');
    await expect(page.locator('ion-app, app-root')).toBeVisible();
  });

  test('flujo registro proveedor accesible', async ({ page }) => {
    await page.goto('/auth/register-provider');
    await expect(page.locator('ion-app, app-root')).toBeVisible();
  });
});
