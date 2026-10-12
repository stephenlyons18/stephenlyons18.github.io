import { defineConfig, devices } from '@playwright/test';

// One project per target device class. Serves the real production build (`pnpm build` first) so
// tests see exactly what GitHub Pages serves, including postbuild's relative paths.
export const VIEWPORTS = {
    desktop: { width: 1920, height: 1080 },
    laptop: { width: 1366, height: 768 },
    tablet: { width: 820, height: 1180 },
    mobile: { width: 390, height: 844 },
} as const;

export default defineConfig({
    testDir: 'e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL: 'http://localhost:4321',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop } },
        { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.laptop } },
        {
            name: 'tablet',
            use: { ...devices['Desktop Chrome'], viewport: VIEWPORTS.tablet, hasTouch: true },
        },
        {
            name: 'mobile',
            use: {
                ...devices['Desktop Chrome'],
                viewport: VIEWPORTS.mobile,
                hasTouch: true,
                isMobile: true,
                deviceScaleFactor: 3,
            },
        },
    ],
    webServer: {
        command: 'pnpm preview --port 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
    },
});
