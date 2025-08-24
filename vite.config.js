import path from "path"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      'process.env.VITE_PINATA_API_KEY': JSON.stringify(env.VITE_PINATA_API_KEY),
      'process.env.VITE_PINATA_SECRET_API_KEY': JSON.stringify(env.VITE_PINATA_SECRET_API_KEY)
    },
    build: {
      outDir: 'dist',
    },
  }
})
