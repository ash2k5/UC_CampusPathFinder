import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    exclude: ['**/node_modules/**', 'tests/rules/**'],
    environment: 'node',
    globals: true,
  },
});
