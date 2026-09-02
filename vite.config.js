import { cloudflare } from '@cloudflare/vite-plugin';
import { sites } from '@openai/sites-vite-plugin';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [sites(), cloudflare({ viteEnvironment: { name: 'server' } })],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: resolve(import.meta.dirname, 'index.html'),
            product: resolve(import.meta.dirname, 'producto.html'),
          },
        },
      },
    },
  },
});
