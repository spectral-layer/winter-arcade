import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// 👉 nome repo GitHub (corretto)
const REPO_NAME = "winter-arcade";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? `/${REPO_NAME}/` : "/",
  plugins: [react()],
  resolve: {
    alias: {
      process: require.resolve("process/browser"),
      buffer: require.resolve("buffer/"),
      stream: require.resolve("stream-browserify"),
      util: require.resolve("util/"),
    },
  },
  define: {
    "process.env": {},
  },
  optimizeDeps: {
    include: ["buffer", "process", "stream-browserify", "util"],
  },

  // ✅ GH Pages via /docs
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
}));
