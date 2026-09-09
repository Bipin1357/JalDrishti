import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PRODUCTION_API_BASE = 'https://jaldrishti-backend-6nko.onrender.com'

export default defineConfig({
  plugins: [react()],

  // Keep local development on the Vite -> FastAPI proxy, but make sure
  // production builds always target the currently deployed Render backend.
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(PRODUCTION_API_BASE),
  },

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
