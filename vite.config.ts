import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,              // escucha en todas las interfaces
    cors: true,              // habilita CORS
    strictPort: true,        // evita que cambie el puerto automáticamente
    origin: "*", // permite que se sirva desde ngrok
    allowedHosts: ["a287-181-234-48-148.ngrok-free.app", "localhost"],
  },
})
