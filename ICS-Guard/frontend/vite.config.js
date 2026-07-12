import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')

  return {
    plugins: [react()],
    envDir: '../',

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      host: true,
      port: parseInt(env.FRONTEND_PORT) || 3000,

      // Cho phép tất cả subdomain của ngrok
      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        'localhost',
        '127.0.0.1',
      ],

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