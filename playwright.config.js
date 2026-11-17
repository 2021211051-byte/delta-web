import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 300000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    viewport: { width: 1280, height: 720 },
    headless: true,
    launchOptions: {
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:8080/health',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
