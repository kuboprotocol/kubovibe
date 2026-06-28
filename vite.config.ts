import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';
import { componentTagger } from 'lovable-tagger';
import { envCheckPlugin } from './vite-plugins/env-check';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = command === 'serve';
  const isProd = !isDev && mode === 'production';

  return {
    server: {
      host: '::',
      port: 8080,
      strictPort: false,
      cors: { origin: '*' },
      hmr: { overlay: true },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          ws: true,
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: false,
    },
    plugins: [
      envCheckPlugin(),
      react({ devTarget: 'es2020' }),
      isDev && componentTagger(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'mask-icon.svg',
          'placeholders/*',
          'fonts/**/*.woff2',
          'game/**/*.webp',
        ],
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: [
            'index.html',
            'assets/*.css',
            'js/*.js',
            'placeholders/*.svg',
          ],
          globIgnores: ['**/*.map', '**/vendor-tldraw-*.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(api\.kubovibe\.dev|cdn\.jsdelivr\.net)\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-runtime',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
              },
            },
            {
              urlPattern: /\.(?:js|css)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'static-resources',
                expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\.(?:glb|gltf|webp|png|jpg|webm)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'game-assets',
                expiration: { maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\.(?:woff|woff2|ttf|otf)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 30 },
              },
            },
          ],
        },
        manifest: {
          name: 'Kubo Vibe - AI-Powered Digital Creation',
          short_name: 'KuboVibe',
          description: 'Create SaaS, dApps, Games & Metaverses with AI',
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          categories: ['productivity', 'games'],
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@types': path.resolve(__dirname, './src/types'),
        '@game': path.resolve(__dirname, './src/game'),
        '@game/engines': path.resolve(__dirname, './src/game/engines'),
        '@game/physics': path.resolve(__dirname, './src/game/physics'),
        '@game/rendering': path.resolve(__dirname, './src/game/rendering'),
      },
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      assetsDir: 'assets',
      assetsInlineLimit: 4096,
      cssCodeSplit: true,
      cssMinify: 'lightningcss',
      sourcemap: !isProd,
      minify: 'terser',
      terserOptions: {
        compress: { drop_console: isProd, drop_debugger: isProd, passes: 2 },
        // NOTE: never enable `mangle.properties` here — it rewrites React's
        // `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` and breaks
        // ReactCurrentOwner in production (white screen).
        mangle: true,
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-popover',
              '@radix-ui/react-tabs',
              '@radix-ui/react-tooltip',
            ],
            'vendor-three': ['three'],
            'vendor-babylon': ['@babylonjs/core'],
            'vendor-physics': ['cannon-es', 'p2', 'oimo'],
            'vendor-graphics': ['pixi.js', 'three-mesh-ui', 'gsap'],
            'vendor-web3': ['@supabase/supabase-js', '@tanstack/react-query'],
            'vendor-exports': ['jspdf', 'jszip', 'xlsx'],
            'vendor-framer': ['framer-motion'],
            'vendor-charts': ['recharts'],
            'vendor-icons': ['lucide-react'],
          },
          entryFileNames: 'js/[name]-[hash].js',
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 1000,
      emptyOutDir: true,
      reportCompressedSize: true,
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@supabase/supabase-js',
        'framer-motion',
      ],
      exclude: ['@capacitor/core'],
    },
  };
});
