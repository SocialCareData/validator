import { defineConfig } from 'vite'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('../package.json') as { version: string }

export default defineConfig({
  root: here,
  // The site is served from https://socialcaredata.github.io/validator/.
  base: process.env['VITE_BASE'] ?? '/validator/',
  publicDir: resolve(here, 'public'),
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
  },
  resolve: {
    // Import the library source directly, so the deployed page can never drift
    // from the package that ships to npm.
    alias: { '@validator': resolve(here, '..', 'src') },
  },
})
