import { defineConfig } from 'vitest/config';
import VitestTableReporter from '../../scripts/vitest-table-reporter';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    reporters: ['default', new VitestTableReporter()],
    clearMocks: true,
    restoreMocks: true
  }
});
