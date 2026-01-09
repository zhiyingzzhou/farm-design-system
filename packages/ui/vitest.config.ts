import path from 'node:path';
import { defineConfig } from 'vitest/config';
import VitestTableReporter from '../../scripts/vitest-table-reporter';

export default defineConfig({
  resolve: {
    alias: {
      '@farm-design-system/theme/react': path.resolve(__dirname, '../theme/src/react.tsx')
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    reporters: ['default', new VitestTableReporter()],
    clearMocks: true,
    restoreMocks: true
  }
});
