import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Electron build: produces .next/standalone/server.js,
  // which electron/main.js launches. Without this the standalone folder is
  // never generated, the server can't start, and the window stays black.
  output: 'standalone',

  // THE fix for "Cannot find module 'next'" in the packaged app.
  // Next.js auto-detects a "tracing root" from lockfiles. When it guesses a
  // parent directory, the standalone output gets nested (e.g.
  // .next/standalone/<subdir>/server.js with node_modules one level up), so
  // the copied `standalone/server.js` can't resolve `next` at runtime.
  // Pinning the root to THIS project forces a flat, predictable layout:
  //   .next/standalone/server.js
  //   .next/standalone/node_modules/next
  outputFileTracingRoot: __dirname,

  // In dev the Electron window loads http://127.0.0.1:3000 while the dev
  // server binds to "localhost". Next.js 16 blocks cross-origin access to
  // dev resources (including the HMR websocket) by default, which caused
  // the "WebSocket handshake ... ERR_INVALID_HTTP_RESPONSE" errors.
  allowedDevOrigins: ['127.0.0.1'],

  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
