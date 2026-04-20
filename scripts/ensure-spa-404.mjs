import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const indexHtml = resolve("dist", "index.html");
const notFound = resolve("dist", "404.html");

if (!existsSync(indexHtml)) {
  console.error("ensure-spa-404: dist/index.html missing — run vite build first.");
  process.exit(1);
}
copyFileSync(indexHtml, notFound);
console.log("ensure-spa-404: copied dist/index.html → dist/404.html (GitHub Pages SPA refresh on /admin).");
