import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { statsDevPlugin } from './vite/stats-dev-plugin'
import { cardJitsuStrict404Plugin } from './vite/card-jitsu-strict-404-plugin'

function resolveGameEntry(pkgName: string, localRelPath: string) {
  const local = path.resolve(__dirname, localRelPath)
  if (fs.existsSync(local)) return local
  return path.resolve(__dirname, 'node_modules', pkgName, 'src/index.ts')
}

export default defineConfig({
  plugins: [react(), statsDevPlugin(), cardJitsuStrict404Plugin()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@nixlabs/game-core': path.resolve(__dirname, 'packages/game-core/src/index.ts'),
      '@nixlabs-games/avoid-the-spikes': resolveGameEntry('@nixlabs-games/avoid-the-spikes', '../game-avoid-the-spikes/src/index.ts'),
      '@nixlabs-games/pong': resolveGameEntry('@nixlabs-games/pong', '../game-pong/src/index.ts'),
      '@nixlabs-games/fl-tron-3': resolveGameEntry('@nixlabs-games/fl-tron-3', '../game-fl-tron-3/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      output: {
        // Long-lived, content-hashed chunks make Cloudflare's edge cache useless
        // for everything except index.html.
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'vendor-react'
            }
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The sandbox proxies the dev server under a generated host name.
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
