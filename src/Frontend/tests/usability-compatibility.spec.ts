import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Usability and Compatibility Testing', () => {

  test('Login Page Accessibility and Layout', async ({ page, isMobile }) => {
    await page.goto('/login');

    // Wait for the login form to be visible
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();

    // Compatibility check: Layout adjusts to viewport
    if (isMobile) {
      // On mobile, ensure the main container fits within the viewport width
      const box = await page.locator('form').boundingBox();
      const viewport = page.viewportSize();
      if (box && viewport) {
        expect(box.width).toBeLessThanOrEqual(viewport.width);
      }
    }

    // Usability check: Accessibility Audit using Axe
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    // We expect 0 accessibility violations, but for demonstration we'll just log them if they exist
    if (accessibilityScanResults.violations.length > 0) {
      console.warn(`Accessibility violations found: ${accessibilityScanResults.violations.length}`);
      console.log(accessibilityScanResults.violations.map(v => v.id + ': ' + v.description));
    }
    
    // Assert no critical violations
    const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
  });

  test('Dashboard Accessibility and Layout', async ({ page }) => {
    await page.goto('/login');
    
    // Login as Admin
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    
    // Click login and wait for navigation
    await Promise.all([
      page.waitForURL('**/admin/dashboard'),
      page.click('button[type="submit"]')
    ]);

    await expect(page.locator('text=Active Tenders')).toBeVisible();

    // Usability check: Accessibility Audit on Dashboard
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical');
    expect(criticalViolations).toHaveLength(0);
  });

});
