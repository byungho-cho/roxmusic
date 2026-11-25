import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  workers: 2,
  reporter: 'list',
  outputDir: 'artifacts/browser',
  use: { baseURL: 'http://127.0.0.1:5175', locale: 'ko-KR', timezoneId: 'Asia/Seoul', screenshot: 'only-on-failure' },
  projects: [
    { name: 'cover', use: { viewport: { width: 370, height: 465 } } },
    { name: 'phone', use: { viewport: { width: 412, height: 892 } } },
  ],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5175', reuseExistingServer: !process.env.CI },
});
