import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://pretive.com',
  output: 'static',
  adapter: vercel(),
  build: {
    format: 'directory'
  }
});
