import { defineConfig } from 'vitest/config';

/** Momento de compilación (ISO), para ver qué versión se tiene abierta */
const BUILD_DATE = new Date().toISOString();

export default defineConfig({
  // Rutas relativas: la app funciona aunque se publique en una subcarpeta
  base: './',
  define: { __BUILD_DATE__: JSON.stringify(BUILD_DATE) },
  server: { host: true, port: 5173 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
