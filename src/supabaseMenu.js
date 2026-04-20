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
  };
}

export function mapMenuRowToDish(row) {
  const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
  const badges = Array.isArray(row.badges) ? row.badges : [];
  return {
    id: row.id,
    categoryId: row.category_id,
    name: {
      en: row.name_en ?? "",
      ka: row.name_ka ?? "",
      ru: row.name_ru ?? "",
    },
    description: {
      en: row.description_en ?? "",
      ka: row.description_ka ?? "",
      ru: row.description_ru ?? "",
    },
    price: Number(row.price) || 0,
    image: row.image_url ?? "",
    ingredients,
    badges,
    available: row.available !== false,
    featured: !!row.featured,
  };
}

export async function fetchMenuDishes() {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase
    .from("menu")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!data?.length) return [];
  return data.map(mapMenuRowToDish);
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

/** Insert one row into public.menu (English fields filled; ka/ru empty). */
export async function insertMenuItem({
  categoryId,
  name,
  description,
  price,
  imageUrl,
  available = true,
  featured = false,
}) {
  if (!supabase) throw new Error("Supabase is not configured");
  const row = dishToDbInsert({
    categoryId,
    name: { en: name, ka: "", ru: "" },
    description: { en: description, ka: "", ru: "" },
    price,
    image: imageUrl,
    ingredients: [],
    badges: [],
    available,
    featured,
  });
  const { error } = await supabase.from("menu").insert(row);
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
  return (data ?? []).map(mapSeatingRow);
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
