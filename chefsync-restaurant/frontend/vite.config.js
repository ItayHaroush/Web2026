import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020', // ⚠️ Safer target for wider compatibility (In-App Browsers)
    sourcemap: true,   // ✅ Enable source maps for debugging production errors
  }
})
