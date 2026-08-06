import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROLES = [
  {
    name: 'Admin',
    email: 'admin@example.com',
    password: 'admin123',
    pages: [
      '/admin/dashboard',
      '/admin/work-orders',
      '/admin/masters/tenders',
      '/admin/projects',
      '/admin/milestone-approvals',
      '/admin/masters/inspectors',
      '/admin/billing',
      '/admin/payments',
      '/vendors',
      '/admin/reports',
      '/admin/alerts',
      '/admin/documents',
      '/admin/settings'
    ]
  },
  {
    name: 'Vendor',
    email: 'vendor@example.com',
    password: 'vendor123',
    pages: [
      '/vendor/dashboard',
      '/vendor/work-orders',
      '/vendor/bills',
      '/vendor/defects',
      '/vendor/progress',
      '/vendor/milestones',
      '/vendor/queries'
    ]
  },
  {
    name: 'Inspector',
    email: 'inspector@example.com',
    password: 'inspector123',
    pages: [
      '/inspector/dashboard',
      '/inspector/work-orders',
      '/inspector/visits',
      '/inspector/progress-review'
    ]
  },
  {
    name: 'Department',
    email: 'dept@example.com',
    password: 'dept123',
    pages: [
      '/department/dashboard',
      '/admin/work-orders',
      '/admin/reports',
      '/admin/audit-logs'
    ]
  },
  {
    name: 'Finance',
    email: 'finance@example.com',
    password: 'finance123',
    pages: [
      '/finance/dashboard',
      '/admin/reports',
      '/admin/audit-logs'
    ]
  }
];

test.describe('Comprehensive Accessibility Audit', () => {

  // Test the Login page separately
  test('Login Page Accessibility', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `Accessibility violations found on Login page: ${JSON.stringify(results.violations.map(v => v.id))}`).toEqual([]);
  });

  for (const role of ROLES) {
    test.describe(`Role: ${role.name}`, () => {
      
      test.beforeEach(async ({ page }) => {
        // Login before each page check to ensure a fresh session or navigate properly
        await page.goto('/login');
        await page.fill('input[type="email"]', role.email);
        await page.fill('input[type="password"]', role.password);
        await Promise.all([
          page.waitForURL('**/dashboard'),
          page.click('button[type="submit"]')
        ]);
      });

      for (const route of role.pages) {
        test(`Accessibility on ${route}`, async ({ page }) => {
          await page.goto(route);
          // Wait for a short duration to let any API calls and rendering finish
          await page.waitForTimeout(2000); 
          
          const results = await new AxeBuilder({ page }).analyze();
          expect(results.violations, `Accessibility violations found on ${route} for ${role.name}: ${JSON.stringify(results.violations.map(v => v.id))}`).toEqual([]);
        });
      }
    });
  }
});
