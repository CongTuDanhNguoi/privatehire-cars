import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Calls to /api go to the shared backend (be/), so the session cookie is same-origin (no CORS).
    // In Docker, API_PROXY_TARGET=http://be:4000.
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:4000",
    },
    watch: process.env.CHOKIDAR_USEPOLLING === "true" ? { usePolling: true, interval: 300 } : undefined,
  },
});
