import path from "path";
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: "buffer",
    },
  },
  build: {
    minify: 'terser',
    terserOptions: { compress: { passes: 3 }, format: { comments: false } },
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
  },
});
