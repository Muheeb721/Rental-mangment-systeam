import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000'
const proxyTarget = /^https?:\/\//i.test(backendTarget) ? backendTarget.replace(/\/api\/?$/, '') : 'http://localhost:5000'

// The dev proxy is same-origin for the browser, so drop Origin before forwarding
// (lets the site work behind a temporary public tunnel without CORS changes).
const stripOrigin = (proxy) => {
  proxy.on('proxyReq', (req) => req.removeHeader('origin'))
  proxy.on('proxyReqWs', (req) => req.removeHeader('origin'))
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
        configure: stripOrigin,
      },
      '/socket.io': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        configure: stripOrigin,
      },
    },
  },
})
