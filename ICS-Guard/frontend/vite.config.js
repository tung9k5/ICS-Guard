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
      port: parseInt(env.FRONTEND_PORT) || 3000,

      allowedHosts: [
        '.ngrok-free.app',
        '.ngrok.app',
        'localhost',
        '127.0.0.1',
      ],

      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || env.VITE_BACKEND_URL || 'http://localhost:8000',
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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf'
            if (id.includes('reactflow') || id.includes('d3')) return 'topology'
            if (id.includes('recharts')) return 'charts'
            if (id.includes('socket.io-client')) return 'socket'
            if (id.includes('react')) return 'react-vendor'
            return 'vendor'
          },
        },
      },
    },
  }
})
