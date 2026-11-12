import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** Сценарии взаимодействия в настоящем браузере на production-сборке. */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } }],
});
