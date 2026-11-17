import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Staff Portal dev server: http://localhost:5174, API calls go through the /api proxy (same origin → no CORS).
// In Docker, API_PROXY_TARGET=http://be:4000 and VITE_USE_POLLING=true (file events from Windows mounts).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? "http://localhost:4000",
    },
    fs: {
      // Shared validation rules live outside web/ (../be/src/validation, ../src/validation).
      allow: [".."],
    },
    watch: process.env.VITE_USE_POLLING === "true" ? { usePolling: true, interval: 300 } : undefined,
  },
});
