import { defineConfig } from 'father';

export default defineConfig({
  esm: {
    output: 'es',
    ignores: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*']
  },
  cjs: {
    output: 'lib',
    ignores: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*']
  }
});
