const { test, expect } = require('@playwright/test');

test.describe('GSN School App smoke', () => {
  test('login and open dashboard', async ({ page }) => {
    // Adjust baseURL if you run server on a different host/port
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';

    await page.goto(base + '/login.html', { waitUntil: 'networkidle' });

    // Fill login form
    await page.fill('#staffId', 'GSN-A-001');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/staff-dashboard.html', { timeout: 5000 });
    await expect(page).toHaveURL(/staff-dashboard.html/);

    // Check that a known dashboard element is visible (recent students list)
    await page.waitForSelector('#recentStudents', { timeout: 5000 });
    const studentsExist = await page.$$('#recentStudents .table-row');
    expect(studentsExist.length).toBeGreaterThanOrEqual(0);

    // Click first available actionable button (if any)
    const firstButton = await page.$('button');
    if (firstButton) {
      await firstButton.click();
      // small delay to let any handler run
      await page.waitForTimeout(300);
    }
  });
});
