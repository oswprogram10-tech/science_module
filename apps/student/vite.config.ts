import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Capacitor 앱은 앱 스킴(capacitor://, https://localhost) 루트에서 열지만, 상대 경로로 두면 어느 쪽이든 동작한다.
  base: './',
  plugins: [react()],
});
