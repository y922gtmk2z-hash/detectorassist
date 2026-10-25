import { defineConfig } from 'vite';

// Relative base so the build works at https://<user>.github.io/<repo>/
// as well as on a custom domain.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
