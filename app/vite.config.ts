import fs from "node:fs"
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const legacyRoot = path.resolve(import.meta.dirname, "../public")

/**
 * Ships two things from the original prototype next to the app:
 * - journeys/ — screenshots referenced by the journey register (served in dev too);
 * - legacy/   — the original prototype, kept reachable for side-by-side comparison.
 */
function legacyAssets(): Plugin {
  let outDir = "dist"
  return {
    name: "spiro-legacy-assets",
    configResolved(c) { outDir = path.resolve(c.root, c.build.outDir) },
    configureServer(server) {
      server.middlewares.use("/journeys", (req, res, next) => {
        const file = path.join(legacyRoot, "journeys", decodeURIComponent((req.url || "").split("?")[0]))
        if (!file.startsWith(path.join(legacyRoot, "journeys")) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return next()
        res.setHeader("Content-Type", "image/png")
        fs.createReadStream(file).pipe(res)
      })
    },
    closeBundle() {
      fs.cpSync(path.join(legacyRoot, "journeys"), path.join(outDir, "journeys"), { recursive: true })
      fs.cpSync(legacyRoot, path.join(outDir, "legacy"), { recursive: true })
    },
  }
}

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    legacyAssets(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // The hand-maintained manifest in public/ stays the source of truth.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,webmanifest}"],
        globIgnores: ["journeys/**", "legacy/**"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/\/legacy\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  // preserveSymlinks: OneDrive reparse points make the bundler resolve packages to paths it then rejects.
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") }, preserveSymlinks: true },
  server: { fs: { allow: [path.resolve(import.meta.dirname, "..")] } },
  build: { chunkSizeWarningLimit: 900 },
})
