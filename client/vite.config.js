import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Automatically detect the backend port from server/.env if set, defaulting to 4000
let backendPort = 4000;
try {
  const currentDir = import.meta.dirname || path.resolve();
  const envPath = path.resolve(currentDir, '../server/.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const portMatch = envContent.match(/^PORT\s*=\s*(\d+)/m);
    if (portMatch) {
      backendPort = Number(portMatch[1]);
    }
  }
} catch {
  backendPort = 4000;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy all /api calls to the backend on the dynamically detected backend port.
    // Using 127.0.0.1 avoids IPv6 (::1) ECONNREFUSED mismatch errors on Windows.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res && res.writeHead && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: `Backend server is not running on port ${backendPort}. Please start the backend with 'npm run dev'.`,
                })
              );
            }
          });
        },
      },
    },
  },
});
