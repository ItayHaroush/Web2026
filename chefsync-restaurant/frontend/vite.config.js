import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function readDeployVersion() {
  try {
    const p = path.join(__dirname, 'public', 'build-version.json')
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    return String(j.version ?? '0')
  } catch {
    return '0'
  }
}

const appDeployVersion = readDeployVersion()

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_DEPLOY_VERSION__: JSON.stringify(appDeployVersion),
  },
  build: {
    target: 'es2020', // ⚠️ Safer target for wider compatibility (In-App Browsers)
    sourcemap: true,   // ✅ Enable source maps for debugging production errors
  },
})
