import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
      port: parseInt(env.FRONTEND_PORT),
      fs: {
        allow: ['..']
      },

      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        'localhost',
        '127.0.0.1',
        '.onrender.com'
      ],

      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET,
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
          additionalData: (content, filepath) => {
            if (filepath.includes('base_color.scss')) {
              return content;
            }
            return `@use "@/assets/base_color" as *;\n` + content;
          },
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