import { defineConfig } from 'vitest/config';

// Unit tests only (data integrity + build-time generators). Browser tests live in e2e/ and run
// through Playwright — keep the two apart so `pnpm test` stays fast (<2s).
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
    },
});
