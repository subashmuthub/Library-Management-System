import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5176,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
      "/auth": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
