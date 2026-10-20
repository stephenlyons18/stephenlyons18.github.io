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
    // The whole job history streams line by line (~15s on its own); allow for a busy machine.
    test.setTimeout(60_000);
    await expect(page.locator('#terminal-body')).toContainText('Intern / Laser Technician', {
        timeout: 30_000,
    });
});

test('paint runs off the terminal window once it opens, never over its text', async ({ page }) => {
    await page.goto('/');
    await page.locator('.nav-terminal-btn').click();
    await expect(page.locator(overlay)).toHaveClass(/active/);
    const drips = page.locator('.term-drips');
    await expect(drips).toHaveAttribute('aria-hidden', 'true');
    // Every run pours out to full length…
    await expect
        .poll(
            () =>
                drips.evaluate((el) =>
                    [...el.querySelectorAll('.drip-run')].every(
                        (r) =>
                            getComputedStyle(r).visibility === 'visible' &&
                            Math.abs(new DOMMatrixReadOnly(getComputedStyle(r).transform).m42) <
                                0.5,
                    ),
                ),
            { timeout: 5000 },
        )
        .toBe(true);
    // …below the window frame, not over the terminal.
    const panel = (await page.locator('.terminal-panel').boundingBox())!;
    const strip = (await drips.boundingBox())!;
    expect(strip.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
    await page.locator('#terminal-input').press('Escape');
    await expect
        .poll(() =>
            drips.evaluate((el) => getComputedStyle(el.querySelector('.drip-run')!).visibility),
        )
        .toBe('hidden');
});
