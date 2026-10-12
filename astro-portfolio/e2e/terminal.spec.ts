import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const overlay = '.terminal-overlay';

test('terminal button opens the terminal and runs a command', async ({ page }) => {
    await page.goto('/about/');
    await page.locator('.nav-terminal-btn').click();
    await expect(page.locator(overlay)).toHaveClass(/active/);
    const input = page.locator('#terminal-input');
    await expect(input).toBeFocused();
    await input.fill('whoami');
    await input.press('Enter');
    await expect(page.locator('#terminal-body')).toContainText('Cybersecurity Engineer');
    await input.press('Escape');
    await expect(page.locator(overlay)).not.toHaveClass(/active/);
});

test('Ctrl+K works even before the lazily-loaded bundle has arrived', async ({
    page,
    isMobile,
}) => {
    test.skip(isMobile, 'no hardware keyboard shortcut on phones');
    await page.goto('/');
    await page.keyboard.press('Control+k'); // immediately — terminal.js is still on its idle timer
    await expect(page.locator(overlay)).toHaveClass(/active/);
    await page.keyboard.press('Control+k');
    await expect(page.locator(overlay)).not.toHaveClass(/active/);
});

test('every [data-open-terminal] button works (the 404 page has two)', async ({ page }) => {
    await page.goto('/404.html');
    const buttons = page.locator('[data-open-terminal]');
    await expect(buttons).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
        const b = buttons.nth(i);
        if (!(await b.isVisible())) continue;
        await b.click();
        await expect(page.locator(overlay)).toHaveClass(/active/);
        await page.keyboard.press('Escape');
        await expect(page.locator(overlay)).not.toHaveClass(/active/);
    }
});

test('skills and experience commands are generated from the data files', async ({ page }) => {
    await page.goto('/contact/');
    await page.locator('.nav-terminal-btn').click();
    const input = page.locator('#terminal-input');
    await input.fill('experience');
    await input.press('Enter');
    await expect(page.locator('#terminal-body')).toContainText('Intern / Laser Technician', {
        timeout: 15_000,
    });
});
