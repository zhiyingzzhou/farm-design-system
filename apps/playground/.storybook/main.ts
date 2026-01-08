import type { StorybookConfig } from '@storybook/react-vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, '../../..');

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  viteFinal: async (viteConfig) => {
    viteConfig.resolve = viteConfig.resolve ?? {};
    viteConfig.resolve.alias = {
      ...(viteConfig.resolve.alias ?? {}),
      '@farm-design-system/ui': path.join(repoRoot, 'packages/ui/src'),
      '@farm-design-system/utils': path.join(repoRoot, 'packages/utils/src'),
      '@farm-design-system/theme': path.join(repoRoot, 'packages/theme/src')
    };
    return viteConfig;
  }
};

export default config;
