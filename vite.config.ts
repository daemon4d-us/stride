import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    // The Stride server (npm run server) handles every external call.
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'esnext' },
})
