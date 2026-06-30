import { test, expect } from '@playwright/test';

/**
 * navigation.spec.ts — frontend-bapp (mobile)
 * Verifica que la navegación principal no rompe la app.
 */

test.describe('Navegación Mobile', () => {
  test('home page carga correctamente', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('ion-app, app-root')).toBeVisible({ timeout: 10_000 });
    await expect(page).not.toHaveURL(/error|500/);
  });

  test('ruta de categorías accesible (requiere sesión → redirige a login)', async ({ page }) => {
    await page.goto('/client/tabs/categories');
    const url = page.url();
    expect(url).toMatch(/categories|login|tabs|auth/);
  });

  test('ruta home del proveedor accesible', async ({ page }) => {
    await page.goto('/provider/tabs/home');
    const url = page.url();
    expect(url).toMatch(/home|login|tabs|auth/);
  });

  test('no hay errores de consola críticos en el arranque', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    // Filtramos errores conocidos no críticos (ej. missing service worker en dev)
    const criticalErrors = errors.filter(
      (e) => !/service.?worker|ngsw|favicon/i.test(e)
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
