import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // The suite is small and CPU-cheap, but the default worker pool spawns one
    // process per core and exhausts heap on memory-constrained machines
    // (observed: "Fatal JavaScript out of memory" during deserialization).
    // A single fork runs the whole suite in ~2s with a flat memory profile.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
