import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Development keeps using the Vite -> FastAPI proxy.
  // Production uses VITE_API_BASE_URL supplied by Vercel.
  server: {
    port: 5501,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
