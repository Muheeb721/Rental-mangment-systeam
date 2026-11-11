import { defineConfig } from 'vite'
import process from 'node:process'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

const backendTarget = (process.env.VITE_API_URL || process.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api\/?$/, '')

// /api plus the backend's static image folders are proxied in dev/preview
const backendProxy = Object.fromEntries(['/api', '/uploads', '/images'].map((prefix) => [prefix, { target: backendTarget, changeOrigin: true, secure: false }]))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: backendProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    proxy: backendProxy,
  },
})
