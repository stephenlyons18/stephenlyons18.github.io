import { test as base } from '@playwright/test';

export * from '@playwright/test';

/**
 * Every spec imports `test` from here. Each page carries Cloudflare's analytics tag verbatim (BaseLayout,
 * R58), so the beacon and its report are stubbed: test runs never send hits to the live dashboard, never
 * fail on its cross-origin report from localhost, and measure only the site's own bytes.
 */
export const test = base.extend({
    context: async ({ context }, use) => {
        await context.route(/^https:\/\/static\.cloudflareinsights\.com\//, (r) =>
            r.fulfill({ contentType: 'text/javascript', body: '' }),
        );
        await context.route(/^https:\/\/cloudflareinsights\.com\//, (r) =>
            r.fulfill({ status: 204 }),
        );
        await use(context);
    },
});
