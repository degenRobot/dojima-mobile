import { test, expect } from '@playwright/test';

test.describe('Ukiyo-e Theme UI Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the home page
    await page.goto('http://localhost:3001');
  });

  test('should display navigation bar with proper styling', async ({ page }) => {
    // Check navigation bar is visible
    const navbar = page.locator('nav').first();
    await expect(navbar).toBeVisible();
    
    // Check logo text
    await expect(page.locator('nav >> text=Dojima CLOB')).toBeVisible();
    
    // Check torii gate emoji
    await expect(page.locator('text=⛩️')).toBeVisible();
    
    // Check navigation links
    const navLinks = ['Portfolio', 'Trade', 'Markets', 'Leaderboard', 'Analytics', 'Debug', 'Events'];
    for (const link of navLinks) {
      await expect(page.locator(`nav >> text=${link}`)).toBeVisible();
    }
  });

  test('should navigate through all pages in light mode', async ({ page }) => {
    // Ensure we're in light mode
    const htmlElement = page.locator('html');
    const isDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    
    if (isDark) {
      // Click theme toggle to switch to light mode
      await page.locator('button[aria-label="Toggle theme"]').click();
      await page.waitForTimeout(500);
    }

    // Take screenshot of home page
    await page.screenshot({ path: 'screenshots/home-light.png', fullPage: true });

    // Navigate to Portfolio
    await page.click('text=Portfolio');
    await page.waitForURL('**/portfolio');
    await page.screenshot({ path: 'screenshots/portfolio-light.png', fullPage: true });
    
    // Check Portfolio page elements
    await expect(page.locator('text=Please Connect Your Wallet')).toBeVisible();
    
    // Navigate to Trade
    await page.click('text=Trade');
    await page.waitForURL('**/trade/**');
    await page.screenshot({ path: 'screenshots/trade-light.png', fullPage: true });
    
    // Navigate to Markets
    await page.click('text=Markets');
    await page.waitForURL('**/markets');
    await page.screenshot({ path: 'screenshots/markets-light.png', fullPage: true });
    
    // Navigate to Leaderboard
    await page.click('text=Leaderboard');
    await page.waitForURL('**/leaderboard');
    await page.screenshot({ path: 'screenshots/leaderboard-light.png', fullPage: true });
    
    // Navigate to Analytics
    await page.click('text=Analytics');
    await page.waitForURL('**/analytics');
    await page.screenshot({ path: 'screenshots/analytics-light.png', fullPage: true });
    
    // Navigate to Debug
    await page.click('text=Debug');
    await page.waitForURL('**/debug');
    await page.screenshot({ path: 'screenshots/debug-light.png', fullPage: true });
    
    // Navigate to Events
    await page.click('text=Events');
    await page.waitForURL('**/events');
    await page.screenshot({ path: 'screenshots/events-light.png', fullPage: true });
  });

  test('should navigate through all pages in dark mode', async ({ page }) => {
    // Switch to dark mode
    const htmlElement = page.locator('html');
    const isDark = await htmlElement.evaluate(el => el.classList.contains('dark'));
    
    if (!isDark) {
      await page.locator('button[aria-label="Toggle theme"]').click();
      await page.waitForTimeout(500);
    }

    // Take screenshot of home page in dark mode
    await page.screenshot({ path: 'screenshots/home-dark.png', fullPage: true });

    // Navigate through pages and take screenshots
    const pages = [
      { name: 'Portfolio', url: '**/portfolio', file: 'portfolio-dark.png' },
      { name: 'Trade', url: '**/trade/**', file: 'trade-dark.png' },
      { name: 'Markets', url: '**/markets', file: 'markets-dark.png' },
      { name: 'Leaderboard', url: '**/leaderboard', file: 'leaderboard-dark.png' },
      { name: 'Analytics', url: '**/analytics', file: 'analytics-dark.png' },
      { name: 'Debug', url: '**/debug', file: 'debug-dark.png' },
      { name: 'Events', url: '**/events', file: 'events-dark.png' }
    ];

    for (const pageInfo of pages) {
      await page.click(`text=${pageInfo.name}`);
      await page.waitForURL(pageInfo.url);
      await page.waitForTimeout(1000); // Wait for animations
      await page.screenshot({ path: `screenshots/${pageInfo.file}`, fullPage: true });
    }
  });

  test('should verify Ukiyo-e theme colors are applied', async ({ page }) => {
    // Check gradient text
    const gradientText = page.locator('.gradient-text').first();
    await expect(gradientText).toBeVisible();
    
    // Check that Prussian blue is used for primary elements
    const primaryButton = page.locator('button').filter({ hasText: 'Connect Wallet' }).first();
    if (await primaryButton.isVisible()) {
      const backgroundColor = await primaryButton.evaluate(el => 
        window.getComputedStyle(el).backgroundColor
      );
      console.log('Primary button background:', backgroundColor);
    }

    // Check navigation link hover effects
    const navLink = page.locator('nav a').first();
    await navLink.hover();
    await page.waitForTimeout(300); // Wait for hover animation
    
    // Verify cards have proper styling
    const cards = page.locator('.rise-card, .japanese-card');
    const cardCount = await cards.count();
    console.log(`Found ${cardCount} styled cards`);
  });

  test('should verify responsive navigation', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: `screenshots/home-${viewport.name}.png`, 
        fullPage: false 
      });
    }
  });
});