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

/**
 * GitHub Pages: `…/repo?query` ხშირად redirect-დება `…/repo/`-ზე query-ს გარეშე.
 * სინქრონული სკრიპტი index.html-ში — pathname `…/repo` → `…/repo/` იგივე search/hash-ით (მოდულებამდე).
 */
function injectRepoTrailingSlashNormalize() {
  return {
    name: "inject-repo-trailing-slash",
    transformIndexHtml(html) {
      const basePath = pagesBase();
      const baseNoSlash = basePath.replace(/\/$/, "");
      if (!baseNoSlash) return html;
      const safe = JSON.stringify(baseNoSlash);
      const script = `<script>!function(){var b=${safe},p=location.pathname;if(p!==b)return;var n=b+"/"+location.search+location.hash;if(n!==p+location.search+location.hash)history.replaceState(history.state,"",n);}();</script>`;
      return html.replace("<head>", `<head>${script}`);
    },
  };
}

export default defineConfig({
  base: pagesBase(),
  plugins: [react(), injectRepoTrailingSlashNormalize()],
  /** ლოკალური IP-ით (მაგ. ტელეფონიდან) წვდომისთვის — გასვლითი ინტერფეისი, არა მხოლოდ localhost */
  server: { host: true, port: 3001, strictPort: true },
  preview: { host: true, port: 3001, strictPort: true },
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
