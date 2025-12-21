import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets load correctly on GitHub Pages subpaths
  define: {
    // Injects the API key from the environment variable during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
});
