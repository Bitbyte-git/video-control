import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5174",
      "/health": "http://127.0.0.1:5174",
      "/video.mp4": "http://127.0.0.1:5174",
    },
    strictPort: true,
  },
});
