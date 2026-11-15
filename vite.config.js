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
    outDir: 'dist',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'solana-core': ['@solana/web3.js', '@solana/spl-token'],
          'metaplex': ['@metaplex-foundation/mpl-token-metadata'],
          'wallet': [
            '@solana/wallet-adapter-base',
            '@solana/wallet-adapter-phantom',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-react-ui',
          ],
          'ui-vendor': ['react', 'react-dom', 'lucide-react', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
});
