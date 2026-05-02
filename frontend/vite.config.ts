import { defineConfig } from "vite";

const BACKEND_PORT = process.env.PORT ?? "8787";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://localhost:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
