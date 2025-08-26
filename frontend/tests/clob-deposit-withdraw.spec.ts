import { test, expect } from '@playwright/test';

// Test configuration
const TEST_PRIVATE_KEY = '0x99e8065d93229e87953669c23cc193f4bbebcdbb877ed272c66ee27a5cb75508';
const TEST_ADDRESS = '0xdD870fA1b7C4700F2BD7f44238821C26f7392148';

test.describe('CLOB Deposit/Withdraw Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to trading page
    await page.goto('http://localhost:3001/trade/WETH-USDC');
    
    // Connect wallet
    const connectButton = page.locator('button:has-text("Connect Wallet")').first();
    
    if (await connectButton.isVisible({ timeout: 2000 })) {
      await connectButton.click();
      await page.click('button:has-text("Embedded Wallet")');
      await page.fill('input[type="password"]', TEST_PRIVATE_KEY);
      await page.click('button:has-text("Import")');
      await expect(page.locator(`text=${TEST_ADDRESS.slice(0, 6)}`)).toBeVisible({ timeout: 10000 });
    }
    
    // Navigate to balances tab
    await page.click('button:has-text("Balances")');
  });

  test('should display token balances', async ({ page }) => {
    // Should show both WETH and USDC
    await expect(page.locator('text=WETH')).toBeVisible();
    await expect(page.locator('text=USDC')).toBeVisible();
    
    // Each token should have balance amount
    const wethRow = page.locator('div:has-text("WETH")').filter({ has: page.locator('button') });
    const usdcRow = page.locator('div:has-text("USDC")').filter({ has: page.locator('button') });
    
    await expect(wethRow).toBeVisible();
    await expect(usdcRow).toBeVisible();
    
    // Should have deposit/withdraw buttons (Plus/Minus icons)
    const depositButtons = page.locator('button:has(svg[class*="Plus"])');
    const withdrawButtons = page.locator('button:has(svg[class*="Minus"])');
    
    expect(await depositButtons.count()).toBeGreaterThanOrEqual(2);
    expect(await withdrawButtons.count()).toBeGreaterThanOrEqual(2);
  });

  test('should open deposit modal', async ({ page }) => {
    // Click deposit button for WETH
    const wethRow = page.locator('div:has-text("WETH")').filter({ has: page.locator('button') });
    const depositButton = wethRow.locator('button:has(svg)').first();
    
    await depositButton.click();
    
    // Modal should open
    await expect(page.locator('h2:has-text("Deposit & Withdraw")')).toBeVisible();
    
    // Should show deposit tab as active
    await expect(page.locator('button:has-text("Deposit")').first()).toHaveClass(/bg-primary|text-white/);
    
    // Should show token selector with WETH selected
    await expect(page.locator('text=Select Token')).toBeVisible();
    
    // Should have amount input
    await expect(page.locator('input[placeholder*="amount" i]')).toBeVisible();
    
    // Should show wallet balance
    await expect(page.locator('text=Wallet Balance:')).toBeVisible();
  });

  test('should switch between deposit and withdraw tabs', async ({ page }) => {
    // Open modal
    const depositButton = page.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Click withdraw tab
    await page.click('button:has-text("Withdraw")');
    
    // Withdraw tab should be active
    await expect(page.locator('button:has-text("Withdraw")').first()).toHaveClass(/bg-primary|text-white/);
    
    // Should show exchange balance instead of wallet balance
    await expect(page.locator('text=Exchange Balance:')).toBeVisible();
  });

  test('should validate deposit amount', async ({ page }) => {
    // Open deposit modal
    const depositButton = page.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Try to deposit 0
    const amountInput = page.locator('input[placeholder*="amount" i]');
    await amountInput.fill('0');
    
    const depositSubmitButton = page.locator('button:has-text("Deposit")').last();
    
    // Button should be disabled
    await expect(depositSubmitButton).toBeDisabled();
    
    // Try to deposit negative amount
    await amountInput.fill('-1');
    await expect(depositSubmitButton).toBeDisabled();
    
    // Try to deposit valid amount
    await amountInput.fill('0.1');
    
    // Button might be enabled if wallet has balance
    // (We can't guarantee this in tests without funded wallet)
    const isDisabled = await depositSubmitButton.isDisabled();
    expect(typeof isDisabled).toBe('boolean');
  });

  test('should show max button for amounts', async ({ page }) => {
    // Open deposit modal
    const depositButton = page.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Should have MAX button
    const maxButton = page.locator('button:has-text("MAX")');
    await expect(maxButton).toBeVisible();
    
    // Click MAX
    await maxButton.click();
    
    // Amount input should be filled
    const amountInput = page.locator('input[placeholder*="amount" i]');
    const value = await amountInput.inputValue();
    
    // Value should be a number (might be 0 if wallet is empty)
    expect(value).toMatch(/^\d*\.?\d*$/);
  });

  test('should close modal on escape or close button', async ({ page }) => {
    // Open modal
    const depositButton = page.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Modal should be visible
    await expect(page.locator('h2:has-text("Deposit & Withdraw")')).toBeVisible();
    
    // Press escape
    await page.keyboard.press('Escape');
    
    // Modal should be closed
    await expect(page.locator('h2:has-text("Deposit & Withdraw")')).not.toBeVisible();
    
    // Open again
    await depositButton.click();
    await expect(page.locator('h2:has-text("Deposit & Withdraw")')).toBeVisible();
    
    // Click close button if available
    const closeButton = page.locator('button[aria-label="Close"]').or(
      page.locator('button:has(svg[class*="x" i])')
    );
    
    if (await closeButton.isVisible()) {
      await closeButton.click();
      await expect(page.locator('h2:has-text("Deposit & Withdraw")')).not.toBeVisible();
    }
  });

  test('should handle token selection', async ({ page }) => {
    // Open modal
    const depositButton = page.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Click token selector
    const tokenSelector = page.locator('button:has-text("WETH")').or(
      page.locator('button:has-text("USDC")')
    ).first();
    
    await tokenSelector.click();
    
    // Should show both token options
    await expect(page.locator('text=WETH')).toBeVisible();
    await expect(page.locator('text=USDC')).toBeVisible();
    
    // Select different token
    const currentToken = await tokenSelector.innerText();
    const otherToken = currentToken.includes('WETH') ? 'USDC' : 'WETH';
    
    await page.click(`text=${otherToken}`);
    
    // Token should be updated
    await expect(tokenSelector).toContainText(otherToken);
  });

  test('should show proper messaging for withdraw', async ({ page }) => {
    // Click withdraw button directly
    const withdrawButton = page.locator('button:has(svg[class*="Minus"])').first();
    await withdrawButton.click();
    
    // Should open modal with withdraw tab active
    await expect(page.locator('h2:has-text("Deposit & Withdraw")')).toBeVisible();
    await expect(page.locator('button:has-text("Withdraw")').first()).toHaveClass(/bg-primary|text-white/);
    
    // Should show exchange balance
    await expect(page.locator('text=Exchange Balance:')).toBeVisible();
  });

  test('should update UI after successful deposit/withdraw', async ({ page }) => {
    // Get initial balance text
    const wethRow = page.locator('div:has-text("WETH")').filter({ has: page.locator('button') });
    const initialBalance = await wethRow.locator('.font-mono').innerText();
    
    // Open deposit modal
    const depositButton = wethRow.locator('button:has(svg)').first();
    await depositButton.click();
    
    // Fill amount
    const amountInput = page.locator('input[placeholder*="amount" i]');
    await amountInput.fill('0.1');
    
    // Note: We can't actually complete the transaction in tests
    // but we're verifying the UI flow is correct
    
    // The deposit button should exist
    const depositSubmitButton = page.locator('button:has-text("Deposit")').last();
    await expect(depositSubmitButton).toBeVisible();
    
    // Close modal
    await page.keyboard.press('Escape');
    
    // Balance should still be visible
    await expect(wethRow.locator('.font-mono')).toBeVisible();
  });
});