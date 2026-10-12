import { defineConfig, devices } from '@playwright/test';

// One project per target device class (desktop, laptop, phone). Serves the real production build
// (`pnpm build` first) so tests see exactly what GitHub Pages serves, including postbuild's
// relative paths.
export const VIEWPORTS = {
    desktop: { width: 1920, height: 1080 },
    laptop: { width: 1366, height: 768 },
    mobile: { width: 390, height: 844 },
} as const;

type DeviceUse = NonNullable<Parameters<typeof defineConfig>[0]['use']>;
const DEVICES: [string, DeviceUse][] = [
    ['desktop', { ...devices['Desktop Chrome'], viewport: VIEWPORTS.desktop }],
    ['laptop', { ...devices['Desktop Chrome'], viewport: VIEWPORTS.laptop }],
    [
        'mobile',
        {
            ...devices['Desktop Chrome'],
            viewport: VIEWPORTS.mobile,
            hasTouch: true,
            isMobile: true,
            deviceScaleFactor: 3,
        },
    ],
];

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
        ...DEVICES.map(([name, use]) => ({ name, use, testIgnore: /(perf|budget)\.spec\.ts/ })),
        // Measurements run after the functional tests, in two waves, so they measure the site and
        // not other tests competing for CPU: page weight + throttled load first, then frame timing.
        ...DEVICES.map(([name, use]) => ({
            name: `budget-${name}`,
            use,
            testMatch: /budget\.spec\.ts/,
            dependencies: DEVICES.map(([n]) => n),
        })),
        ...DEVICES.map(([name, use]) => ({
            name: `perf-${name}`,
            use,
            testMatch: /perf\.spec\.ts/,
            dependencies: DEVICES.map(([n]) => `budget-${n}`),
        })),
    ],
    webServer: {
        command: 'pnpm preview --port 4321',
        url: 'http://localhost:4321',
        reuseExistingServer: !process.env.CI,
    },
});
