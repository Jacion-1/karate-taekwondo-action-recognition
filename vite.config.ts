import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) {
              return 'recharts';
            }
            if (
              id.includes('d3-') ||
              id.includes('victory-vendor') ||
              id.includes('lodash') ||
              id.includes(' decimal.js')
            ) {
              return 'chart-vendor';
            }
            if (
              id.includes('react') ||
              id.includes('dexie') ||
              id.includes('zod') ||
              id.includes('lucide-react')
            ) {
              return 'vendor';
            }
          }
          return undefined;
        },
      },
    },
  },
});

