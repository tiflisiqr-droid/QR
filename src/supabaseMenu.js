import { supabase } from "./supabaseClient.js";

const BUCKET = "menu-images";

/** Accepts admin/form input: trims, allows comma as decimal separator (e.g. 12,50). */
export function parsePriceValue(value) {
  if (value === "" || value == null) return NaN;
  const s = String(value).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

/** Price in tetri (cents) for exact integer math (avoids 2.3 * 6 → 13.799999…). */
export function priceToCents(price) {
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Display ₾ amount with at most 2 decimals (no float garbage). */
export function formatLari(amount) {
  const cents = priceToCents(amount);
  const v = cents / 100;
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Maps app dish shape → DB row (no `id`). */
export function dishToDbInsert(dish) {
  const price = parsePriceValue(dish.price);
  return {
    category_id: dish.categoryId,
    name_en: dish.name?.en ?? "",
    name_ka: dish.name?.ka ?? "",
    name_ru: dish.name?.ru ?? "",
    description_en: dish.description?.en ?? "",
    description_ka: dish.description?.ka ?? "",
    description_ru: dish.description?.ru ?? "",
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    image_url: dish.image ?? "",
    ingredients: Array.isArray(dish.ingredients) ? dish.ingredients : [],
    badges: Array.isArray(dish.badges) ? dish.badges : [],
    available: dish.available !== false,
    featured: !!dish.featured,
    sort_order: Number.isFinite(Number(dish.order)) ? Number(dish.order) : 0,
  };
}

/** JSONB / text from DB may arrive as array or JSON string — normalize for UI. */
function normalizeStringArrayField(value) {
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t);
      if (Array.isArray(p)) return p.map((x) => String(x ?? "").trim()).filter(Boolean);
    } catch {
      /* plain string, not JSON */
    }
  }
  return [];
}

export function mapMenuRowToDish(row) {
  if (!row || row.id == null || row.id === "") return null;
  const ingredients = normalizeStringArrayField(row.ingredients);
  const badges = normalizeStringArrayField(row.badges);
  const rawCat = row.category_id;
  const categoryId =
    rawCat == null || rawCat === ""
      ? null
      : Number.isFinite(Number(rawCat)) && String(Number(rawCat)) === String(rawCat).trim()
        ? Number(rawCat)
        : rawCat;
  const desc =
    row.description && typeof row.description === "object" && !Array.isArray(row.description)
      ? row.description
      : null;
  return {
    id: row.id,
    categoryId,
    name: {
      en: row.name_en ?? "",
      ka: row.name_ka ?? "",
      ru: row.name_ru ?? "",
    },
    description: desc
      ? {
          en: String(desc.en ?? ""),
          ka: String(desc.ka ?? ""),
          ru: String(desc.ru ?? ""),
        }
      : {
          en: String(row.description_en ?? ""),
          ka: String(row.description_ka ?? ""),
          ru: String(row.description_ru ?? ""),
        },
    price: Number(row.price) || 0,
    image: row.image_url ?? "",
    ingredients,
    badges,
    available: row.available !== false,
    featured: !!row.featured,
    order: Number(row.sort_order) || 0,
  };
}

export async function fetchMenuDishes() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("menu")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return [];
  return data.map(mapMenuRowToDish).filter(Boolean);
}

/* ─── Menu categories (Admin → Cuisine → Categories) ───────────────────── */

export function mapMenuCategoryRow(row) {
  if (!row || row.id == null || row.id === "") return null;
  return {
    id: row.id,
    name: {
      en: row.name_en ?? "",
      ka: row.name_ka ?? "",
      ru: row.name_ru ?? "",
    },
    icon: typeof row.icon === "string" && row.icon ? row.icon : "◆",
    order: Number(row.sort_order) || 0,
  };
}

function categoryToDbRow(cat) {
  return {
    id: cat.id,
    name_en: cat.name?.en ?? "",
    name_ka: cat.name?.ka ?? "",
    name_ru: cat.name?.ru ?? "",
    icon: String(cat.icon ?? "◆").slice(0, 8) || "◆",
    sort_order: Number(cat.order) || 0,
  };
}

export async function fetchMenuCategories() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("menu_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMenuCategoryRow).filter(Boolean);
}

export async function insertMenuCategory(cat) {
  if (!supabase) throw new Error("Supabase is not configured");
  const row = categoryToDbRow(cat);
  const { data, error } = await supabase.from("menu_categories").insert(row).select("*").single();
  if (error) throw error;
  return mapMenuCategoryRow(data);
}

export async function updateMenuCategory(id, cat) {
  if (!supabase) throw new Error("Supabase is not configured");
  const row = categoryToDbRow({ ...cat, id });
  const { data, error } = await supabase
    .from("menu_categories")
    .update({
      name_en: row.name_en,
      name_ka: row.name_ka,
      name_ru: row.name_ru,
      icon: row.icon,
      sort_order: row.sort_order,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapMenuCategoryRow(data);
}

/** Persist order after ↑/↓ in admin (batch). */
export async function updateMenuCategorySortOrders(orderById) {
  if (!supabase) throw new Error("Supabase is not configured");
  const entries = Object.entries(orderById).filter(([k]) => Number.isFinite(Number(k)));
  const results = await Promise.all(
    entries.map(([idStr, order]) =>
      supabase.from("menu_categories").update({ sort_order: order }).eq("id", Number(idStr))
    )
  );
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) throw firstErr;
}

/** Persist dish order within category after ↑/↓ in admin (batch). Keys = row ids (uuid or string). */
export async function updateMenuDishSortOrders(orderById) {
  if (!supabase) throw new Error("Supabase is not configured");
  const entries = Object.entries(orderById).filter(([k]) => k != null && String(k) !== "");
  const results = await Promise.all(
    entries.map(([id, order]) =>
      supabase.from("menu").update({ sort_order: Number(order) || 0 }).eq("id", id)
    )
  );
  const firstErr = results.find((r) => r.error)?.error;
  if (firstErr) throw firstErr;
}

export async function deleteMenuCategory(id) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("menu_categories").delete().eq("id", id);
  if (error) throw error;
}

/** Upload file to Storage bucket `menu-images`; returns public URL. */
export async function uploadMenuImage(file) {
  if (!supabase) throw new Error("Supabase is not configured");
  const rawExt = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
  const ext = rawExt.slice(0, 8) || "jpg";
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/** Insert one row into public.menu. `description` may be a string (EN only) or { en, ka, ru }. */
export async function insertMenuItem({
  categoryId,
  name,
  description,
  price,
  imageUrl,
  available = true,
  featured = false,
  sortOrder,
}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const desc =
    typeof description === "string"
      ? { en: description, ka: "", ru: "" }
      : {
          en: description?.en ?? "",
          ka: description?.ka ?? "",
          ru: description?.ru ?? "",
        };
  const orderVal =
    sortOrder !== undefined && sortOrder !== null && Number.isFinite(Number(sortOrder))
      ? Number(sortOrder)
      : Math.floor(Date.now() / 1000) % 1_000_000;
  const row = dishToDbInsert({
    categoryId,
    name: { en: name, ka: "", ru: "" },
    description: desc,
    price,
    image: imageUrl,
    ingredients: [],
    badges: [],
    available,
    featured,
    order: orderVal,
  });
  const { error } = await supabase.from("menu").insert(row);
  if (error) throw error;
}

/** Cloud admin: set only `image_url` for an existing row (other fields unchanged). */
export async function updateMenuDishImageUrl(id, imageUrl) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("menu").update({ image_url: imageUrl }).eq("id", id);
  if (error) throw error;
}

/** Full dish from Cuisine admin (all locales). Returns created row as app dish. */
export async function insertFullMenuDish(dish) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.from("menu").insert(dishToDbInsert(dish)).select("*").single();
  if (error) throw error;
  return mapMenuRowToDish(data);
}

export async function updateFullMenuDish(id, dish) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.from("menu").update(dishToDbInsert(dish)).eq("id", id).select("*").single();
  if (error) throw error;
  return mapMenuRowToDish(data);
}

export async function deleteMenuDishById(id) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("menu").delete().eq("id", id);
  if (error) throw error;
}

export async function setMenuDishAvailable(id, available) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("menu").update({ available }).eq("id", id);
  if (error) throw error;
}

/* ─── Seating (tables) — public.seating, shared across all devices ─────── */

export function mapSeatingRow(row) {
  if (!row || row.id == null || row.id === "") return null;
  return {
    id: row.id,
    name: typeof row.name === "string" ? row.name : "",
    zone: typeof row.zone === "string" ? row.zone : "",
    active: row.active !== false,
    sort_order: Number(row.sort_order) || 0,
  };
}

export async function fetchSeatingTables() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("seating")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSeatingRow).filter(Boolean);
}

export async function insertSeatingTable({ name, zone }) {
  if (!supabase) throw new Error("Supabase is not configured");
  const row = {
    name: String(name || "").trim(),
    zone: String(zone || "").trim() || "Hall",
    active: true,
    sort_order: Math.floor(Date.now() / 1000) % 1_000_000,
  };
  const { data, error } = await supabase.from("seating").insert(row).select("*").single();
  if (error) throw error;
  return mapSeatingRow(data);
}

export async function updateSeatingTable(id, patch) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.from("seating").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return mapSeatingRow(data);
}

export async function deleteSeatingTable(id) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.from("seating").delete().eq("id", id);
  if (error) throw error;
}
