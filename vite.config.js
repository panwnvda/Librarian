import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@blocknote/core',
      '@blocknote/react',
      '@blocknote/mantine',
      '@mantine/core',
      '@mantine/hooks',
    ],
  },
});
