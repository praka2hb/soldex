import { defineConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer()
  ],
  resolve: {
    alias:{
      '@': path.resolve(__dirname, './src')
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  }
})
