import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  // ES worker format so @jsquash's multi-threaded AVIF encoder and
  // other code-split worker bundles can be built (default 'iife' rejects
  // multi-chunk worker output).
  worker: {
    format: 'es',
  },
  // Exclude @jsquash packages from Vite's dep pre-bundling. Pre-bundling
  // rewrites `new URL('./foo.wasm', import.meta.url)` into a path that
  // doesn't exist on the dev server, causing the SPA fallback to return
  // index.html instead of the WASM binary and failing with
  // `expected magic word 00 61 73 6d, found 3c 21 44 4f` (`<!DO…`).
  // Native ESM resolution preserves the sibling .wasm relative URL.
  optimizeDeps: {
    exclude: ['@jsquash/avif'],
  },
  server: {
    proxy: {
      '/shard': {
        target: 'http://localhost:8686',
        changeOrigin: true,
      },
    },
  },
})
