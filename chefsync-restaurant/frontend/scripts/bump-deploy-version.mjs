#!/usr/bin/env node
/**
 * מריץ לפני build / דיפלוי: מייצר מזהה גרסה חדש כדי שדפדפנים וה-Service Worker
 * ימשכו קבצים מעודכנים (cache bust ל-firebase-messaging-sw, ובדיקה מול build-version.json).
 *
 * שימוש:
 *   node scripts/bump-deploy-version.mjs
 *   npm run bump-version
 *   npm run build:deploy    (bump + vite build)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const out = path.join(root, 'public', 'build-version.json')

function gitShort() {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

const builtAt = new Date().toISOString()
const stamp = builtAt.replace(/[-:T.Z]/g, '').slice(0, 14)
const git = gitShort()
const version = git ? `${stamp}-${git}` : stamp

const payload = {
  version,
  builtAt,
  ...(git ? { git } : {}),
}

fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8')
process.stdout.write(`[bump-deploy-version] wrote ${path.relative(root, out)} → ${version}\n`)
