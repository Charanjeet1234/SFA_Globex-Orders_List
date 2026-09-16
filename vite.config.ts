import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // server.js owns the HTTP port; give this project its own HMR socket so
      // local edits do not collide with another Vite session on the machine.
      hmr: {
        host: '127.0.0.1',
        port: Number(process.env.SFA_HMR_PORT || 24679),
      },
    },
  };
});
