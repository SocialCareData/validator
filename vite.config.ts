import { defineConfig } from 'vite'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('./package.json') as { version: string }

export default defineConfig({
  root: here,
  // The site is served from https://socialcaredata.github.io/validator/.
  base: process.env['VITE_BASE'] ?? '/validator/',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
})
