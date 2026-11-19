// Removes the previous SPA build from backend/public WITHOUT touching Laravel's own files.
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const pub = fileURLToPath(new URL('../../backend/public/', import.meta.url))
for (const entry of ['assets', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
  rmSync(pub + entry, { recursive: true, force: true })
}
console.log('Cleaned previous SPA build in', pub)
