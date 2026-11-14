import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Rutas relativas: la app funciona aunque se publique en una subcarpeta
  base: './',
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
