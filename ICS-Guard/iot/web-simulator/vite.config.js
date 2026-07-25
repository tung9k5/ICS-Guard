import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '')

  return {
    plugins: [react()],
    envDir: '../../',
    // The browser simulator is a demo-only surface. Keep its injected keys in
    // sync with the backend source of truth so duplicate VITE_* values cannot
    // silently drift and make every public device request return 401.
    define: {
      'import.meta.env.VITE_SIMULATOR_API_KEY': JSON.stringify(
        env.SIMULATOR_API_KEY || env.VITE_SIMULATOR_API_KEY || ''
      ),
      'import.meta.env.VITE_ATTACK_SIMULATOR_API_KEY': JSON.stringify(
        env.ATTACK_SIMULATOR_API_KEY || env.VITE_ATTACK_SIMULATOR_API_KEY || ''
      ),
    },

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      host: true,
      port: parseInt(env.WEB_SIMULATOR_PORT) || 5174,

      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        'localhost',
        '127.0.0.1',
      ],

      proxy: {
        '/api': {
          target: 'http://backend:8000',
          changeOrigin: true,
        },
      },

      watch: {
        usePolling: true,
      },
    },

    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          silenceDeprecations: [
            'legacy-js-api',
            'color-functions',
            'global-builtin',
          ],
        },
      },
    },
  }
})
