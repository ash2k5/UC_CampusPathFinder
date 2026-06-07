import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

// Next.js allows JSX in .js files; Vite's transformer does not.
// Parse app/*.js as JSX before the core transform sees it.
const jsxInJs = {
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (id.includes('/node_modules/') || !/\/app\/.*\.js$/.test(id)) return null;
    return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
  },
};

export default defineConfig({
  plugins: [jsxInJs, react()],
  test: {
    include: ['tests/**/*.test.{js,jsx}'],
    environment: 'node',
    globals: true,
  },
});
