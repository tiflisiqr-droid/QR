/**
 * Extracts tri-lingual menu from "დასაბეჭდი მენიუ" style PDF (KA / RU / EN sections)
 * and writes SQL for public.menu_categories + public.menu.
 *
 * Usage:
 *   node scripts/generate-menu-sql-from-print-pdf.mjs "C:/path/დასაბეჭდი მენიუ.pdf"
 *   node scripts/generate-menu-sql-from-print-pdf.mjs "C:/path/დასაბეჭდი მენიუ.pdf" --out supabase/seed-print-menu.sql
 *
 * Uses category_id range 200–299 so you can wipe/re-import without touching defaults 1–6:
 *   DELETE FROM public.menu WHERE category_id BETWEEN 200 AND 299;
 *   DELETE FROM public.menu_categories WHERE id BETWEEN 200 AND 299;
 */

import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const CATEGORY_ID_BASE = 200;
const PLACEHOLDER_IMAGE = "";

const JUNK = new RegExp(
  [
    "^Wireless",
    "^Password",
    "^00000000",
    "^@tiflis",
    "^Restaurant Tiflisi",
    "^tiflisi$",
    "^-- \\d of 3 --$",
    "^ტიფლისი",
    "^\\s*$",
  ].join("|"),
  "i"
);

function sqlStr(s) {
  if (s == null) return "''";
  return `'${String(s).replace(/'/g, "''")}'`;
}

function stripHeaders(block) {
  const lines = block.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t || JUNK.test(t) || /^Restaurant/i.test(t)) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join("\n");
}

function isJunkLine(t) {
  if (!t || !t.trim()) return true;
  if (JUNK.test(t.trim())) return true;
  if (/^[\d\s]+$/.test(t.trim()) && t.trim().length <= 3) return true;
  if (t.trim() === "." || t.trim() === "—") return true;
  return false;
}

/** Strip tab + trailing dot column junk so `16,50  . . .` is recognized as a price line. */
function normalizeMenuLine(line) {
  return line
    .replace(/\t+/g, " ")
    .replace(/(?:\s*\.){2,}\s*$/, "")
    .trim();
}

/** Category title: no trailing price, no dot leaders, not parenthetical continuation. */
function isProbablyCategory(line) {
  const t = normalizeMenuLine(line);
  if (!t) return false;
  if (/\d+[.,]\d{2}\s*$/.test(t)) return false;
  if (/\.{2,}/.test(t)) return false;
  if (/^\(/.test(t)) return false;
  if (t.length > 95) return false;
  if (/^[\d\s.,]+$/.test(t)) return false;
  return true;
}

function prettifyTitle(s) {
  return String(s || "")
    .replace(/^\.+/g, "")
    .replace(/(?:\s*\.){2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePriceAtEnd(joined) {
  const m = joined.match(/^(.+?)\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d{2,3}[.,]\d{2})\s*$/);
  if (!m) return null;
  let name = prettifyTitle(m[1]);
  const raw = m[2].replace(/\s/g, "");
  const normalized = raw.includes(",") && !raw.includes(".") ? raw.replace(",", ".") : raw.replace(",", "");
  const price = Number.parseFloat(normalized);
  if (!Number.isFinite(price) || price < 0 || price > 5000) return null;
  return { name, price };
}

/** Flat list: same dish order as print PDF (KA / RU / EN columns). */
function parseLanguageBlock(raw) {
  const text = stripHeaders(raw);
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  let category = "Other";
  const buf = [];
  const dishes = [];

  const flush = (lineWithPrice) => {
    const cleaned = normalizeMenuLine(lineWithPrice);
    const joined = buf.length ? `${buf.join(" ")} ${cleaned}` : cleaned;
    buf.length = 0;
    const p = parsePriceAtEnd(joined.replace(/\t+/g, " "));
    if (!p) return;
    dishes.push({ category, name: p.name, price: p.price });
  };

  for (const line of lines) {
    if (isJunkLine(line)) continue;
    if (buf.length === 0 && isProbablyCategory(line)) {
      category = prettifyTitle(normalizeMenuLine(line));
      continue;
    }
    const cl = normalizeMenuLine(line);
    if (/\d+[.,]\d{2}\s*$/.test(cl)) {
      flush(line);
    } else {
      buf.push(line);
    }
  }
  return dishes;
}

function splitTriLingual(fullText) {
  const a = fullText.split("-- 1 of 3 --");
  const ka = a[0] || "";
  const rest = a[1] || "";
  const b = rest.split("-- 2 of 3 --");
  const ru = b[0] || "";
  const rest2 = b[1] || "";
  const c = rest2.split("-- 3 of 3 --");
  const en = c[0] || "";
  return { ka, ru, en };
}

function median3(a, b, c) {
  const arr = [a, b, c].filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (arr.length === 0) return 0;
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return (arr[0] + arr[1]) / 2;
  return arr[1];
}

/**
 * KA list is the column master. RU/EN PDF text order can drift by ±1; match by price
 * in a sliding window around index i (prefer closest index, then smallest Δprice).
 */
function pickMatch(list, i, used, targetPrice, win) {
  const lo = Math.max(0, i - win);
  const hi = Math.min(list.length - 1, i + win);
  let bestJ = -1;
  let bestScore = Infinity;
  for (let j = lo; j <= hi; j++) {
    if (used.has(j)) continue;
    const dp = Math.abs(list[j].price - targetPrice);
    const di = Math.abs(j - i) * 0.001;
    const score = dp + di;
    if (score < bestScore) {
      bestScore = score;
      bestJ = j;
    }
  }
  return bestJ;
}

function zipDishesAligned(kaList, ruList, enList, win = 8) {
  if (kaList.length !== ruList.length || kaList.length !== enList.length) {
    console.warn(`Dish count — KA:${kaList.length} RU:${ruList.length} EN:${enList.length} (aligning to KA length).`);
  }
  const usedR = new Set();
  const usedE = new Set();
  const out = [];
  for (let i = 0; i < kaList.length; i++) {
    const ka = kaList[i];
    const jr = pickMatch(ruList, i, usedR, ka.price, win);
    const je = pickMatch(enList, i, usedE, ka.price, win);
    if (jr < 0 || je < 0) {
      console.warn(`No RU/EN match at KA #${i + 1} (${ka.name.slice(0, 40)} · ${ka.price}) — skipping row.`);
      continue;
    }
    usedR.add(jr);
    usedE.add(je);
    const ru = ruList[jr];
    const en = enList[je];
    const price = median3(ka.price, ru.price, en.price);
    if (Math.abs(ka.price - ru.price) > 0.15 || Math.abs(ka.price - en.price) > 0.15) {
      console.warn(`Price check #${i + 1}: ${ka.price} / ${ru.price} / ${en.price} → ${price}`);
    }
    out.push({
      categoryKa: prettifyTitle(ka.category),
      categoryRu: prettifyTitle(ru.category),
      categoryEn: prettifyTitle(en.category),
      nameKa: prettifyTitle(ka.name),
      nameRu: prettifyTitle(ru.name),
      nameEn: prettifyTitle(en.name),
      price,
    });
  }
  if (usedR.size !== ruList.length || usedE.size !== enList.length) {
    console.warn(`Unused RU lines: ${ruList.length - usedR.size}, EN: ${enList.length - usedE.size} (duplicate prices / window).`);
  }
  return out;
}

function buildCategoryMap(rows) {
  const keys = [];
  const map = new Map();
  let order = 0;
  for (const r of rows) {
    const key = prettifyTitle(r.categoryEn || r.categoryKa || r.categoryRu);
    if (!map.has(key)) {
      map.set(key, {
        id: CATEGORY_ID_BASE + keys.length,
        name_en: r.categoryEn || "",
        name_ka: r.categoryKa || "",
        name_ru: r.categoryRu || "",
        order: ++order,
      });
      keys.push(key);
    }
  }
  return { keys, map };
}

async function main() {
  const pdfPath = process.argv[2];
  let outPath = "supabase/seed-print-menu.sql";
  const outIdx = process.argv.indexOf("--out");
  if (outIdx !== -1 && process.argv[outIdx + 1]) outPath = process.argv[outIdx + 1];

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    console.error('Usage: node scripts/generate-menu-sql-from-print-pdf.mjs "<path-to.pdf>" [--out file.sql]');
    process.exit(1);
  }

  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const { text } = await parser.getText();
  await parser.destroy();

  const { ka, ru, en } = splitTriLingual(text);
  const kaD = parseLanguageBlock(ka);
  const ruD = parseLanguageBlock(ru);
  const enD = parseLanguageBlock(en);
  console.error(`Parsed dishes — KA:${kaD.length} RU:${ruD.length} EN:${enD.length}`);

  const zipped = zipDishesAligned(kaD, ruD, enD, 10);
  const { keys, map } = buildCategoryMap(zipped);

  const lines = [];
  lines.push("-- Generated by scripts/generate-menu-sql-from-print-pdf.mjs");
  lines.push("-- Safe range: category ids 200–299. Review before run.");
  lines.push("");
  lines.push("DELETE FROM public.menu WHERE category_id BETWEEN 200 AND 299;");
  lines.push("DELETE FROM public.menu_categories WHERE id BETWEEN 200 AND 299;");
  lines.push("");

  const icons = ["◈", "◇", "◉", "◌", "◎", "◊", "▣", "▤", "▥", "▦", "▧", "▨"];
  for (const k of keys) {
    const c = map.get(k);
    const icon = icons[(c.id - CATEGORY_ID_BASE) % icons.length];
    lines.push(
      `INSERT INTO public.menu_categories (id, name_en, name_ka, name_ru, icon, sort_order) VALUES (${c.id}, ${sqlStr(c.name_en)}, ${sqlStr(c.name_ka)}, ${sqlStr(c.name_ru)}, ${sqlStr(icon)}, ${c.order});`
    );
  }
  lines.push("");

  for (const row of zipped) {
    const key = row.categoryEn || row.categoryKa || row.categoryRu;
    const cid = map.get(key).id;
    lines.push(
      `INSERT INTO public.menu (category_id, name_en, name_ka, name_ru, description_en, description_ka, description_ru, price, image_url, ingredients, badges, available, featured) VALUES (${cid}, ${sqlStr(row.nameEn)}, ${sqlStr(row.nameKa)}, ${sqlStr(row.nameRu)}, '', '', '', ${row.price}, ${sqlStr(PLACEHOLDER_IMAGE)}, '{}', '{}', true, false);`
    );
  }

  const out = lines.join("\n") + "\n";
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, "utf8");
  console.error(`Wrote ${outPath} (${zipped.length} dishes, ${keys.length} categories).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
