import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// The /projects/ lightbox (ProjectGallery.astro + Lightbox.astro): a native modal <dialog>.

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

const thumb = (page: Page) => page.locator('[data-lightbox]').first();
const dialog = (page: Page) => page.locator('dialog.lightbox');

/** Wait out the zoom (Lightbox.astro marks the dialog while its View Transition runs). */
async function settled(page: Page) {
    await page.waitForFunction(() => !document.querySelector('dialog.lightbox[data-zooming]'));
}

async function openFirst(page: Page) {
    await page.goto('/projects/');
    await thumb(page).scrollIntoViewIfNeeded();
    await thumb(page).click();
    await expect(dialog(page)).toBeVisible();
    await settled(page);
    await expect
        .poll(() =>
            dialog(page)
                .locator('img')
                .evaluate((i: HTMLImageElement) => i.naturalWidth),
        )
        .toBeGreaterThan(0);
}

test('thumbnail opens the full-size image in a modal dialog', async ({ page }) => {
    await openFirst(page);
    const want = await thumb(page).getAttribute('data-src');
    const img = dialog(page).locator('img');
    expect(await img.getAttribute('src')).toBe(want);
    expect(await img.getAttribute('alt')).toBe(
        await thumb(page).locator('img').getAttribute('alt'),
    );
    // Modal: focus is inside, and the page underneath can't scroll.
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog.lightbox'))).toBe(
        true,
    );
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
        'hidden',
    );
    // The image fits the viewport.
    const box = (await img.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.width).toBeLessThanOrEqual(vp.width);
});

test('Escape closes it and focus returns to the thumbnail', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await openFirst(page);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(thumb(page)).toBeFocused();
});

test('the close button and a tap anywhere close it', async ({ page }) => {
    await openFirst(page);
    await dialog(page).locator('.lightbox-close').click();
    await expect(dialog(page)).toBeHidden();
    await settled(page);
    await thumb(page).click();
    await expect(dialog(page)).toBeVisible();
    await settled(page);
    const vp = page.viewportSize()!;
    await page.mouse.click(8, vp.height - 8); // the backdrop corner
    await expect(dialog(page)).toBeHidden();
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).not.toBe(
        'hidden',
    );
});

test('keyboard: Enter on a focused thumbnail opens it', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on phones');
    await page.goto('/projects/');
    await thumb(page).focus();
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
});

test('open lightbox has no serious axe violations', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFirst(page);
    const results = await new AxeBuilder({ page })
        .include('dialog.lightbox')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
    expect(
        results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'),
    ).toEqual([]);
});
