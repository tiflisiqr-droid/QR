import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages project site: https://user.github.io/REPO/ → base must be /REPO/ */
function pagesBase() {
  if (process.env.VITE_BASE_PATH) {
    const p = process.env.VITE_BASE_PATH.trim();
    if (!p || p === "/") return "/";
    return p.endsWith("/") ? p : `${p}/`;
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    const repo = process.env.GITHUB_REPOSITORY?.split("/")?.[1];
    if (repo) return `/${repo}/`;
  }
  return "/";
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react()],
  server: { port: 3001, strictPort: true },
  preview: { port: 3001, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "router";
          // Do not split @supabase into its own chunk: without env it tree-shakes to empty and Rollup warns.
          if (id.includes("react-dom") || /[/\\]node_modules[/\\]react[/\\]/.test(id)) return "react-vendor";
        },
      },
    },
  },
});
