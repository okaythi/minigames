import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export function cardJitsuStrict404Plugin(): Plugin {
  return {
    name: 'card-jitsu-strict-404',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''
        if (url && url.startsWith('/games/card-jitsu/')) {
          // If it's a direct HTML navigation to the game page itself, allow SPA routing
          if (url === '/games/card-jitsu' || url === '/games/card-jitsu/') {
            return next()
          }

          const relPath = url.replace(/^\/games\/card-jitsu\//, '')
          const publicPath = path.resolve(process.cwd(), 'public/games/card-jitsu', relPath)

          if (!fs.existsSync(publicPath) || fs.statSync(publicPath).isDirectory()) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('Not Found')
            return
          }
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ? req.url.split('?')[0] : ''
        if (url && url.startsWith('/games/card-jitsu/')) {
          if (url === '/games/card-jitsu' || url === '/games/card-jitsu/') {
            return next()
          }

          const relPath = url.replace(/^\/games\/card-jitsu\//, '')
          const distPath = path.resolve(process.cwd(), 'dist/games/card-jitsu', relPath)
          const publicPath = path.resolve(process.cwd(), 'public/games/card-jitsu', relPath)

          const exists =
            (fs.existsSync(distPath) && !fs.statSync(distPath).isDirectory()) ||
            (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory())

          if (!exists) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'text/plain')
            res.end('Not Found')
            return
          }
        }
        next()
      })
    },
  }
}
