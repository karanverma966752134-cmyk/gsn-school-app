// Minimal Playwright config to support the smoke test npm script
/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  timeout: 30000,
  use: {
    headless: true,
    ignoreHTTPSErrors: true,
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:3001'
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' }
    }
  ]
};
