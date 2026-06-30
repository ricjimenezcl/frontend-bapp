import { test, expect } from '@playwright/test';

/**
 * provider-flow.spec.ts — frontend-bapp (mobile)
 * Flujos del proveedor en emulación mobile.
 */

test.describe('Proveedor Mobile — guards', () => {
  test('home del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/home');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('agregar servicio redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/provider-add-service');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('reservas del proveedor redirigen a login', async ({ page }) => {
    await page.goto('/provider/tabs/provider-bookings');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('chats del proveedor redirigen a login', async ({ page }) => {
    await page.goto('/provider/tabs/provider-chats');
    await expect(page).toHaveURL(/login|auth/);
  });
});

test.describe('Perfil Mobile — guards', () => {
  test('perfil del cliente redirige a login', async ({ page }) => {
    await page.goto('/client/tabs/client-profile');
    await expect(page).toHaveURL(/login|auth/);
  });

  test('perfil del proveedor redirige a login', async ({ page }) => {
    await page.goto('/provider/tabs/provider-profile');
    await expect(page).toHaveURL(/login|auth/);
  });
});

test.describe('Chat Mobile — guards', () => {
  test('chats del cliente redirigen a login', async ({ page }) => {
    await page.goto('/client/tabs/client-chats');
    await expect(page).toHaveURL(/login|auth/);
  });
});
