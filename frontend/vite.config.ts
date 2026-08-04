import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Dev: Vite (5173) `/api` va `/admin` ni Django'ga (8020) proksi qiladi — bitta origin, sessiya cookie ishlaydi.
// 8020 — chunki bu kompyuterda 8000-port boshqa dastur bilan band.
// Build: `dist/` Django orqali `/static/` ostida beriladi (serverda Node kerak emas).
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/static/" : "/",
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8020",
      "/admin": "http://127.0.0.1:8020",
      "/static/admin": "http://127.0.0.1:8020",
    },
  },
  test: { environment: "node" },
}));
