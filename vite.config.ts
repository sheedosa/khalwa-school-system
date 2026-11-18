import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works at any path (GitHub Pages serves it under /khalwa-school-system/).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
