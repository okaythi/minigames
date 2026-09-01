import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { statsDevPlugin } from './vite/stats-dev-plugin'

export default defineConfig({
  plugins: [react(), statsDevPlugin()],
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
