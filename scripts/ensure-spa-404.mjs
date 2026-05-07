import { copyFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const indexHtml = resolve("dist", "index.html");
const notFound = resolve("dist", "404.html");
const nojekyll = resolve("dist", ".nojekyll");

if (!existsSync(indexHtml)) {
  console.error("ensure-spa-404: dist/index.html missing — run vite build first.");
  process.exit(1);
}
copyFileSync(indexHtml, notFound);
/** GitHub Pages must not use Jekyll (can skip files); Vite may omit empty public files from dist. */
writeFileSync(nojekyll, "");
console.log("ensure-spa-404: copied dist/index.html → dist/404.html; wrote dist/.nojekyll (GitHub Pages SPA).");
