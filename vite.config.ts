import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  // The site is served from https://socialcaredata.github.io/validator/.
  base: process.env['VITE_BASE'] ?? '/validator/',
  // Pre-bundling would move the component away from its worker.js, and its
  // `new URL('./worker.js', import.meta.url)` would point at nothing in dev.
  optimizeDeps: {
    exclude: ['@theodi/data-standard-validator-component'],
    // Excluding it also stops its own dependencies being pre-bundled, and the
    // engine's CommonJS dependencies cannot be served to a browser as they are.
    include: ['@theodi/data-standard-validator-component > @theodi/data-standard-validator'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
})
