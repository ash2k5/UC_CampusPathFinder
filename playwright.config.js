import { defineConfig, devices } from '@playwright/test';

// E2E runs the dev server against the Auth + Firestore emulators (started by
// the test:e2e script's `firebase emulators:exec` wrapper). The OSM proxy and
// map style are stubbed in the specs so the suite needs no external network.
const PORT = 3123;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `next build && next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 240000,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-campus',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-campus.firebaseapp.com',
      NEXT_PUBLIC_FIREBASE_USE_EMULATOR: 'true',
    },
  },
});
