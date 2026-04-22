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
  server: {
    proxy: {
      '/shard': {
        target: 'http://localhost:8686',
        changeOrigin: true,
      },
    },
  },
})
