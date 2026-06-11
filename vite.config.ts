import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { envCheckPlugin } from "./vite-plugins/env-check";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    envCheckPlugin(),
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      workbox: {
        // We set a reasonable limit for precaching
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Exclude large vendor chunks from precaching to avoid build errors
        // They will be handled by runtimeCaching instead
        globIgnores: ['**/vendor-*.js', '**/vendor-*.css'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        // Fallback for larger assets and those excluded from precaching
        runtimeCaching: [
          {
            urlPattern: /assets\/vendor-.*\.js$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'vendor-chunks',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:js|css|html|json)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
              },
            },
          },
        ],
      },
      manifest: {
        name: "Kubo Vibe",
        short_name: "KuboVibe",
        description: "Plataforma Criativa com IA",
        theme_color: "#ffffff",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@types/three')) {
              return 'vendor-three';
            }
            if (id.includes('tldraw')) {
              return 'vendor-tldraw';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('jspdf') || id.includes('jszip') || id.includes('xlsx')) {
              return 'vendor-exports';
            }
            if (id.includes('@supabase') || id.includes('@tanstack/react-query')) {
              return 'vendor-core';
            }
            return 'vendor';
          }
        }
      }
    }
  }
}));