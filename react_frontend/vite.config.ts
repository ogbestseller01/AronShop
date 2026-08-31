import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, 'src');

const srcDirectoryAliases = fs
  .readdirSync(srcRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    find: entry.name,
    replacement: path.resolve(srcRoot, entry.name),
  }));

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [react()],

  build: {
    outDir: 'build',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      },
    },
  },

  css: {
    sourcemap: false,
  },

  resolve: {
    alias: [
      { find: '@', replacement: srcRoot },
      ...srcDirectoryAliases,
    ],
  },

  define: {
    global: 'globalThis',
    'process.env': '{}',
    'process.env.NODE_ENV': JSON.stringify(mode),
  },

  optimizeDeps: {
    include: ['react-sortablejs', 'sortablejs'],
    esbuildOptions: {
      sourcemap: false,
    },
  },

  server: {
    port: 3000,
    fs: { strict: false },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    fileParallelism: false,
  },
}));