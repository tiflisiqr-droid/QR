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
 * Prefer same index when price matches (avoids wrong khinkali / duplicate-price rows).
 * Otherwise smallest price delta, then nearest index.
 */
function pickMatch(list, i, used, targetPrice, win) {
  const lo = Math.max(0, i - win);
  const hi = Math.min(list.length - 1, i + win);
  let bestJ = -1;
  let bestScore = Infinity;
  for (let j = lo; j <= hi; j++) {
    if (used.has(j)) continue;
    const dp = Math.abs(list[j].price - targetPrice);
    const di = Math.abs(j - i);
    const score = dp * 1_000_000 + di;
    if (score < bestScore) {
      bestScore = score;
      bestJ = j;
    }
  }
  return bestJ;
}

/** Map PDF sub-headings / fragments → stable menu group (Georgian key). */
function collapseCategoryKa(raw) {
  const t = prettifyTitle(raw);
  if (!t) return "სხვა";
  if (/დესერტ/i.test(t)) return "დესერტი";
  if (/გარნირი/i.test(t)) return "გარნირი";
  if (/თევზ|ზუთხი|ორაგულის ფილე|შემწვარი ვეფხისებრი|კრევეტ/i.test(t)) return "თევზეული";
  if (/პასტა|რიზოტო/i.test(t)) return "პასტა/რიზოტო";
  if (/ცხელი კერძ/i.test(t)) return "ცხელი კერძები";
  if (/მაყალზე|ჯოსპერ|მომზადებული კერძები/i.test(t)) return "შამფური და ჯოსპერი";
  if (/ხინკალი/i.test(t)) return "ხინკალი";
  if (/ცომეული/i.test(t)) return "ცომეული";
  if (/წვნიანი/i.test(t)) return "წვნიანი";
  if (/ცხელი წასახემს/i.test(t)) return "ცხელი წასახემსებელი";
  if (/ცივი წასახემს/i.test(t)) return "ცივი წასახემსებელი";
  if (/მომზადებული ბოსტნეულით|შერეული მწნილით|სოსისის ასორტ/i.test(t)) return "ცხელი კერძები";
  if (/კარამელიზირებული|მანგო ავოკადო|ცეზარი კრევეტ/i.test(t)) return "სალათი";
  if (/^სალათი$/i.test(t) || (t.length <= 20 && /სალათი/i.test(t) && !/ქათმის|რუკოლა|ბერძნული|ენის|ცეზარი ქათმით|კამეჩის/i.test(t)))
    return "სალათი";
  if (/სალათი/i.test(t)) return "სალათი";
  return t.length > 40 ? t.slice(0, 40) : t;
}

const CAT_LABELS = {
  სალათი: { en: "Salads", ru: "Салаты" },
  "ცივი წასახემსებელი": { en: "Cold appetizers", ru: "Холодные закуски" },
  "ცხელი წასახემსებელი": { en: "Hot appetizers", ru: "Горячие закуски" },
  წვნიანი: { en: "Soups", ru: "Супы" },
  ცომეული: { en: "Bakery", ru: "Выпечка" },
  ხინკალი: { en: "Khinkali", ru: "Хинкали" },
  "შამფური და ჯოსპერი": { en: "Grill & Josper", ru: "Мангал и джоспер" },
  "პასტა/რიზოტო": { en: "Pasta & risotto", ru: "Паста и ризотто" },
  "ცხელი კერძები": { en: "Main courses", ru: "Горячие блюда" },
  თევზეული: { en: "Seafood", ru: "Морепродукты" },
  გარნირი: { en: "Side dishes", ru: "Гарниры" },
  დესერტი: { en: "Desserts", ru: "Десерты" },
  სხვა: { en: "Other", ru: "Прочее" },
};

/** Insert order + stable labels (never use parsed dish lines as category titles). */
const CATEGORY_ORDER = [
  "სალათი",
  "ცივი წასახემსებელი",
  "ცხელი წასახემსებელი",
  "წვნიანი",
  "ცომეული",
  "ხინკალი",
  "შამფური და ჯოსპერი",
  "პასტა/რიზოტო",
  "ცხელი კერძები",
  "თევზეული",
  "გარნირი",
  "დესერტი",
  "სხვა",
];

function applyKnownNameFixes(row) {
  const ka = row.nameKa;
  const ru = row.nameRu;
  const en = row.nameEn;
  if (/^cheese and honey sauce$/i.test(en) && /ყველით და თაფლის/i.test(ka)) {
    return {
      ...row,
      nameKa: "კარამელიზებული მსხლის სალათი ლურჯი ყველით და თაფლის სოუსით",
      nameEn: "Caramelized pear salad with blue cheese and honey sauce",
      nameRu: "Салат из карамелизированной груши с сыром дор блю и медовым соусом",
    };
  }
  if (/^and sweet-sour sauce$/i.test(en) && /კრევეტებით და ტკბილ/i.test(ka)) {
    return {
      ...row,
      nameKa: "მანგოსა და ავოკადოს სალათი კრევეტებით და ტკბილ-ცხარე სოუსით",
      nameEn: "Mango and avocado salad with prawns and sweet-sour sauce",
      nameRu: "Салат с манго и авокадо, креветками и кисло-сладким соусом",
    };
  }
  if (/ტრადიციული ქართული სალათი.*ნიგვზით/i.test(ka) && ru.length < 40) {
    return {
      ...row,
      nameRu: "Традиционный грузинский салат с грецкими орехами",
      nameEn: "Traditional Georgian salad with walnuts",
    };
  }
  if (/^ushroom\b/i.test(en)) {
    return { ...row, nameEn: en.replace(/^ushroom/i, "Mushroom") };
  }
  if (/ореxами/i.test(ru)) {
    return { ...row, nameRu: ru.replace(/ореxами/gi, "орехами") };
  }
  if (/^ореxами$/i.test(ru) && /ნიგვზით/.test(ka)) {
    return {
      ...row,
      nameRu: "Традиционный грузинский салат с грецкими орехами",
      nameEn: "Traditional Georgian salad with walnuts",
    };
  }
  return row;
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
  const present = new Set();
  for (const r of rows) {
    present.add(collapseCategoryKa(r.categoryKa));
  }
  const keys = [];
  const map = new Map();
  let order = 0;
  const addKey = (key) => {
    if (map.has(key)) return;
    const lab = CAT_LABELS[key] || { en: key, ru: key };
    map.set(key, {
      id: CATEGORY_ID_BASE + keys.length,
      name_en: lab.en,
      name_ka: key,
      name_ru: lab.ru,
      order: ++order,
    });
    keys.push(key);
  };
  for (const key of CATEGORY_ORDER) {
    if (present.has(key)) addKey(key);
  }
  for (const key of present) {
    if (!map.has(key)) addKey(key);
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

  let zipped = zipDishesAligned(kaD, ruD, enD, 10);
  zipped = zipped.map(applyKnownNameFixes);
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
    const key = collapseCategoryKa(row.categoryKa);
    const cid = map.get(key)?.id ?? CATEGORY_ID_BASE;
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
