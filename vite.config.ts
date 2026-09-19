import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import youtubeSearchHandler from './api/youtube/search';
import lyricsHandler from './api/lyrics';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/lyrics')) {
          const url = new URL(req.url, 'http://localhost:3000');
          const query: Record<string, string> = {};
          url.searchParams.forEach((val, key) => {
            query[key] = val;
          });
          const customReq = {
            method: req.method,
            query,
            headers: req.headers
          };
          const customRes = {
            statusCode: 200,
            setHeader(k: string, v: string) {
              res.setHeader(k, v);
            },
            status(code: number) {
              this.statusCode = code;
              return this;
            },
            json(data: any) {
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end() {
              res.statusCode = this.statusCode;
              res.end();
            }
          };
          try {
            await lyricsHandler(customReq, customRes);
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message }));
          }
          return;
        }

        if (req.url && req.url.startsWith('/api/youtube/search')) {
          const url = new URL(req.url, 'http://localhost:3000');
          const query: Record<string, string> = {};
          url.searchParams.forEach((val, key) => {
            query[key] = val;
          });
          const customReq = {
            method: req.method,
            query,
            headers: req.headers
          };
          const customRes = {
            statusCode: 200,
            setHeader(k: string, v: string) {
              res.setHeader(k, v);
            },
            status(code: number) {
              this.statusCode = code;
              return this;
            },
            json(data: any) {
              res.statusCode = this.statusCode;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(data));
            },
            end() {
              res.statusCode = this.statusCode;
              res.end();
            }
          };
          try {
            await youtubeSearchHandler(customReq, customRes);
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e.message, items: [] }));
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
