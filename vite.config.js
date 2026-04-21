import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Proxy Prometheus API to avoid CORS in dev.
    // Remove this if you start Prometheus with --web.cors.origin=".*"
    proxy: {
      '/api/v1': {
        target: 'http://localhost:9090',
        changeOrigin: true,
      },
    },
  },
})
