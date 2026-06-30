import { defineConfig, devices } from '@playwright/test';

/**
 * playwright.config.ts — frontend-bapp
 *
 * Solo emula dispositivos móviles (la app corre en Capacitor WebView).
 * Los tests se ejecutan contra `ng serve` (puerto 4200).
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4200';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/playwright-report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // Emulación de los dispositivos objetivo de la app
    {
      name: 'android-pixel5',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'ios-iphone12',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'android-galaxy-s21',
      use: { ...devices['Galaxy S8'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: 'npm run ionic:serve',
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
