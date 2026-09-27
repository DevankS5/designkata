import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  // Mermaid's internals make a ~660 kB chunk. It is loaded lazily, only where a diagram is drawn.
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 700 },
});
