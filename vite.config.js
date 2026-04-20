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
});
