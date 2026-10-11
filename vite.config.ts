import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: './' → GitHub Pages(https://계정.github.io/저장소/)처럼 하위 경로에 올려도 그대로 동작
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
