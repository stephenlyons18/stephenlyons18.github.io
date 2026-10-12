import { expect, test, type Locator, type Page } from '@playwright/test';

test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => sessionStorage.setItem('sl-booted', '1'));
});

/** Scroll the client:visible island into view and wait until React has hydrated it. */
async function openSkills(page: Page, view: 'graph' | 'list' | null) {
    await page.goto('/about/');
    await page.locator('.skill-graph').scrollIntoViewIfNeeded();
    await page
        .locator('astro-island[opts*="SkillGraph"]:not([ssr])')
        .waitFor({ state: 'attached' });
    if (view) await page.getByRole('button', { name: view === 'graph' ? /Graph/ : /List/ }).click();
}

/** Wait for entrance animations (.reveal) to finish so taps land where the element ends up. */
async function settle(page: Page) {
    await page.waitForFunction(() =>
        document
            .getAnimations()
            .every(
                (a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity,
            ),
    );
}

/** Devices without hover (phones, touch tablets) interact by tapping. */
const canHover = (page: Page) => page.evaluate(() => matchMedia('(hover: hover)').matches);

async function box(l: Locator) {
    const b = await l.boundingBox();
    if (!b) throw new Error('not visible');
    return b;
}

/**
 * Find a node: sweep with (fast) mouse moves until a card appears. On touch devices, then move
 * the mouse away and *tap* that point, so the card under test was opened by touch.
 */
async function findNode(page: Page, canvas: Locator, tap: boolean) {
    const c = await box(canvas);
    const card = page.locator('.sg-canvas-wrap .skill-card');
    for (let y = 60; y < c.height - 60; y += 20) {
        for (let x = 60; x < c.width - 60; x += 20) {
            await page.mouse.move(c.x + x, c.y + y);
            if (!(await card.count())) continue;
            // The sweep can catch a node by its rim; tap/return its exact centre (data-anchor).
            const [ax, ay] = (await canvas.getAttribute('data-anchor'))!.split(',').map(Number);
            const at = { x: c.x + ax!, y: c.y + ay! };
            if (tap) {
                await page.mouse.move(c.x + c.width + 50, c.y - 50); // leave → card closes
                await expect(card).toHaveCount(0);
                await page.touchscreen.tap(at.x, at.y);
                await expect(card).toHaveCount(1);
            }
            return at;
        }
    }
    throw new Error('no node found');
}

async function expectAnchored(page: Page, canvas: Locator) {
    const card = page.locator('.sg-canvas-wrap .skill-card');
    const c = await box(canvas);
    const [ax, ay, r] = (await canvas.getAttribute('data-anchor'))!.split(',').map(Number);
    const node = { x: c.x + ax, y: c.y + ay };
    // A node zoomed/panned out of view hides its card instead of pinning it to an edge.
    const offscreen = ax + r < 0 || ay + r < 0 || ax - r > c.width || ay - r > c.height;
    if (offscreen) {
        await expect(card).toBeHidden();
        return;
    }
    await expect(card).toBeVisible();
    const k = await box(card);
    // Inside the canvas…
    expect(k.x).toBeGreaterThanOrEqual(c.x - 1);
    expect(k.y).toBeGreaterThanOrEqual(c.y - 1);
    expect(k.x + k.width).toBeLessThanOrEqual(c.x + c.width + 1);
    expect(k.y + k.height).toBeLessThanOrEqual(c.y + c.height + 1);
    // …directly above or below its node (within the gap), and not covering it.
    const gapAbove = node.y - r - (k.y + k.height);
    const gapBelow = k.y - (node.y + r);
    expect(
        Math.min(Math.abs(gapAbove - 10), Math.abs(gapBelow - 10)),
        'vertical gap to node',
    ).toBeLessThan(4);
    // Horizontally it spans the node — unless the node is at the canvas edge, where the card is
    // clamped 8px inside the bounds instead of overflowing.
    const pinnedLeft = Math.abs(k.x - (c.x + 8)) < 2;
    const pinnedRight = Math.abs(k.x + k.width - (c.x + c.width - 8)) < 2;
    if (!pinnedLeft) expect(node.x).toBeGreaterThanOrEqual(k.x - r - 1);
    if (!pinnedRight) expect(node.x).toBeLessThanOrEqual(k.x + k.width + r + 1);
}

test('graph card anchors to its node and keeps following it', async ({ page, isMobile }) => {
    await openSkills(page, isMobile ? 'graph' : null);
    const canvas = page.locator('.sg-canvas-wrap canvas');
    await canvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await findNode(page, canvas, !(await canHover(page)));
    await expectAnchored(page, canvas);
    // Zooming moves the node on screen; the card must move with it. Mouse: wheel-zoom at the
    // pointer (zoom is cursor-anchored, so the node stays under it). Touch: the + button.
    const before = await canvas.getAttribute('data-anchor');
    if (await canHover(page)) await page.mouse.wheel(0, -300);
    else await page.getByRole('button', { name: 'Zoom in' }).tap();
    await expect(canvas).not.toHaveAttribute('data-anchor', before!);
    await expectAnchored(page, canvas);
});

test('graph has no job nodes; jobs appear as "Used at" on the card', async ({ page }) => {
    await openSkills(page, 'list');
    await expect(page.locator('.skill-category h3', { hasText: 'Experience' })).toHaveCount(0);
    const chip = page.locator('.skill-list li[data-skill="Python"]');
    await chip.scrollIntoViewIfNeeded();
    await settle(page);
    if (await canHover(page)) await chip.hover();
    else await chip.tap();
    const card = page.locator('.skill-list-view .skill-card');
    await expect(card).toContainText('Used at');
    await expect(card).toContainText('Cybersecurity Engineer · Yamaha');
});

test('list card stays attached to its chip when the page scrolls', async ({ page }) => {
    await openSkills(page, 'list');
    const chip = page.locator('.skill-list li[data-skill="AWS"]');
    await chip.scrollIntoViewIfNeeded();
    await settle(page);
    // Keyboard focus (desktop) / tap (touch) keep the card open while the page scrolls —
    // a mouse hover would correctly close it as the chip slides out from under the pointer.
    // Park the mouse in the header so the scroll can't slide another chip under it.
    const hover = await canHover(page);
    if (hover) await page.mouse.move(5, 5);
    if (hover) await chip.focus();
    else await chip.tap();
    await expect(page.locator('.skill-list-view .skill-card')).toContainText('AWS');
    const card = page.locator('.skill-list-view .skill-card');
    await expect(card).toBeVisible();
    const before = { chip: await box(chip), card: await box(card) };
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForTimeout(100);
    await expect(card).toContainText('AWS'); // still the same skill's card
    const after = { chip: await box(chip), card: await box(card) };
    // Both moved by the same amount → still attached.
    expect(Math.abs(after.card.y - after.chip.y - (before.card.y - before.chip.y))).toBeLessThan(2);
    // And the card hugs the chip vertically (directly above or below).
    const gap = Math.min(
        Math.abs(after.card.y - (after.chip.y + after.chip.height)),
        Math.abs(after.chip.y - (after.card.y + after.card.height)),
    );
    expect(gap).toBeLessThan(12);
    // Never wider than the viewport.
    const vw = page.viewportSize()!.width;
    expect(after.card.x).toBeGreaterThanOrEqual(0);
    expect(after.card.x + after.card.width).toBeLessThanOrEqual(vw);
});

test('initial layout: every label readable, none overlapping', async ({ page }) => {
    await openSkills(page, 'graph');
    const canvas = page.locator('.sg-canvas-wrap canvas');
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toHaveAttribute('data-overlaps', '0');
    const scale = Number(await canvas.getAttribute('data-scale'));
    expect(
        scale,
        'camera scale (labels shrink relative to nodes below ~0.7)',
    ).toBeGreaterThanOrEqual(0.7);
});
