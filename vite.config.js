import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PRODUCTION_API_BASE = 'https://jaldrishti-backend-6nko.onrender.com'

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Development keeps using the Vite -> FastAPI proxy. Production is pinned
  // to the live Render backend even if an old Vercel env var still exists.
  ...(mode === 'production'
    ? {
        define: {
          'import.meta.env.VITE_API_BASE_URL': JSON.stringify(PRODUCTION_API_BASE),
        },
      }
    : {}),

  server: {
    port: 5501,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
}))
