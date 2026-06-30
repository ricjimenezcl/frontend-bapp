import { test, expect } from '@playwright/test';

/**
 * booking.spec.ts — frontend-bapp (mobile)
 * Flujo de reservas en emulación de dispositivos móviles.
 */

test.describe('Reservas Mobile — guards', () => {
  test('reservas del cliente redirigen a login', async ({ page }) => {
    await page.goto('/client/tabs/bookings');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('reservas del proveedor redirigen a login', async ({ page }) => {
    await page.goto('/provider/tabs/provider-bookings');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('detalle de proveedor redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/provider-info/1');
    await expect(page).toHaveURL(/login|auth/);
  });
});

test.describe('Pago Mobile', () => {
  test('flujo de pago redirige a login sin sesión', async ({ page }) => {
    await page.goto('/payment');
    await expect(page).toHaveURL(/login|auth/);
  });
});

// ── Con sesión (descomentar tras generar storageState) ───────────────────────
//
// test.describe('Reservas Mobile — cliente autenticado', () => {
//   test.use({ storageState: 'e2e/.auth/client.json' });
//
//   test('lista de reservas carga en mobile', async ({ page }) => {
//     await page.goto('/client/tabs/bookings');
//     await expect(page.locator('ion-app')).toBeVisible();
//     await expect(page).not.toHaveURL(/login/);
//   });
//
//   test('puede contactar a un proveedor desde búsqueda', async ({ page }) => {
//     await page.goto('/client/tabs/service-search');
//     await page.locator('ion-card').first().click();
//     await expect(page).toHaveURL(/provider-info/);
//   });
// });
