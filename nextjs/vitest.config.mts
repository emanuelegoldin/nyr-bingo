/**
 * Vitest configuration: one project per test layer (see docs/tests/README.md)
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Resolve a folder under src/ to an absolute path, for the tsconfig path aliases.
 * @param folder The folder relative to src/
 * @returns The absolute path
 */
const srcPath = (folder: string): string => fileURLToPath(new URL(`./src/${folder}`, import.meta.url)).replace(/\/$/, '');

export default defineConfig({
  resolve: {
    // Mirrors "paths" in tsconfig.json
    alias: {
      '@ui': srcPath('components/ui'),
      '@lib': srcPath('lib'),
      '@components': srcPath('components'),
      '@hooks': srcPath('hooks'),
      '@api': srcPath('app/api'),
      '@': srcPath(''),
    },
  },
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'db',
          include: ['tests/db/**/*.test.ts'],
          setupFiles: ['tests/support/db/setup.ts'],
          // One file at a time: every file holds one connection with an open transaction
          fileParallelism: false,
        },
      },
    ],
  },
});
