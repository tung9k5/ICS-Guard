import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '')

  return {
    plugins: [react()],
    envDir: '../../',


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
          target: env.VITE_PROXY_TARGET || env.VITE_BACKEND_URL || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/hardware-api': {
          target: env.VITE_HARDWARE_BFF_URL || env.VITE_BACKEND_URL || 'http://127.0.0.1:5001',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/hardware-api/, '/api'),
        },
        '/attack-api': {
          target: env.VITE_ATTACK_ADAPTER_URL || env.VITE_BACKEND_URL || 'http://127.0.0.1:5003',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/attack-api/, '/api'),
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
