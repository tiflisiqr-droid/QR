import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import QRCode from "qrcode";
import { supabase, isSupabaseConfigured } from "./src/supabaseClient.js";
import {
  fetchMenuDishes,
  fetchMenuCategories,
  uploadMenuImage,
  insertMenuItem,
  updateMenuDishImageUrl,
  insertFullMenuDish,
  updateFullMenuDish,
  deleteMenuDishById,
  setMenuDishAvailable,
  parsePriceValue,
  priceToCents,
  formatLari,
  fetchSeatingTables,
  insertSeatingTable,
  updateSeatingTable,
  deleteSeatingTable,
  insertMenuCategory,
  updateMenuCategory,
  updateMenuCategorySortOrders,
  updateMenuDishSortOrders,
  deleteMenuCategory,
  normalizePriceVariantsFromRow,
} from "./src/supabaseMenu.js";
import {
  insertServiceAlert,
  fetchServiceAlerts,
  rowToNotification,
  syncNotificationsToSupabase,
} from "./src/supabaseAlerts.js";

/** Category id match (localStorage / JSON may stringify integers vs DB numbers). */
function sameCategoryId(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return String(a) === String(b);
}

/* ─── DATA ───────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: 1, name: { en: "Khinkali", ka: "ხინკალი", ru: "Хинкали" }, icon: "◈", order: 1 },
  { id: 2, name: { en: "Khachapuri", ka: "ხაჭაპური", ru: "Хачапури" }, icon: "◇", order: 2 },
  { id: 3, name: { en: "Grill & Josper", ka: "შამფური და ჯოსპერი", ru: "Мангал и джоспер" }, icon: "◉", order: 3 },
  { id: 4, name: { en: "Salads", ka: "სალათები", ru: "Салаты" }, icon: "◌", order: 4 },
  { id: 5, name: { en: "Desserts", ka: "დესერტები", ru: "Десерты" }, icon: "◎", order: 5 },
  { id: 6, name: { en: "Cellar", ka: "სასმელები", ru: "Погреб" }, icon: "◊", order: 6 },
];

const DISHES = [
  { id:1, categoryId:1, name:{en:"Lamb Khinkali",ka:"კრავის ხინკალი",ru:"Хинкали с Ягнёнком"}, description:{en:"Hand-pleated parcels of slow-spiced mountain lamb in golden broth",ka:"ხელნაკეთი ხინკალი მთის კრავით",ru:"Лепные хинкали из горного ягнёнка"}, price:18, image:"https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=90", ingredients:["Mountain Lamb","Wild Herbs","Black Pepper","Onion","Saffron Broth"], badges:["Signature","Popular"], available:true, featured:true },
  { id:2, categoryId:1, name:{en:"Truffle & Porcini",ka:"ტრიუფელის ხინკალი",ru:"Трюфель и Белый Гриб"}, description:{en:"Black truffle infused wild mushroom filling, aged parmesan crust",ka:"შავი ტრიუფელი, ველური სოკო",ru:"Чёрный трюфель с белыми грибами"}, price:32, image:"https://images.unsplash.com/photo-1551218808-94e220e084d2?w=600&q=90", ingredients:["Black Truffle","Porcini","Aged Parmesan","Thyme"], badges:["Chef's Table"], available:true, featured:true },
  { id:3, categoryId:2, name:{en:"Adjarian Royal",ka:"აჭარული",ru:"Аджарская"}, description:{en:"Sulguni three-cheese blend, farm egg yolk, brown butter, sea salt",ka:"სამი ყველი, სოფლის კვერცხი",ru:"Три сыра, желток, масло"}, price:22, image:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=90", ingredients:["Sulguni","Gouda","Parmesan","Farm Egg","Brown Butter","Fleur de Sel"], badges:["Signature","Popular"], available:true, featured:true },
  { id:4, categoryId:2, name:{en:"Imeruli Khachapuri",ka:"იმერული ხაჭაპური",ru:"Имерская Хачапури"}, description:{en:"Classic round bread, house-churned butter, fresh Imeruli cheese",ka:"იმერული ყველი, კარაქი",ru:"Классическая с имерским сыром"}, price:16, image:"https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&q=90", ingredients:["Imeruli Cheese","House Butter","Eggs"], badges:[], available:true, featured:false },
  { id:5, categoryId:3, name:{en:"Wagyu Mtsvadi",ka:"ვაგიუ მწვადი",ru:"Вагю Мцвади"}, description:{en:"A5 Wagyu skewer, pomegranate reduction, smoked salt, tkemali jus",ka:"A5 ვაგიუ, ბროწეული",ru:"А5 Вагю с гранатовым жю"}, price:68, image:"https://images.unsplash.com/photo-1558030006-450675393462?w=600&q=90", ingredients:["A5 Wagyu","Pomegranate","Smoked Salt","Tkemali","Rosemary"], badges:["Chef's Table","New"], available:true, featured:true },
  { id:6, categoryId:3, name:{en:"Lamb Short Ribs",ka:"კრავის ნეკნები",ru:"Короткие Рёбра"}, description:{en:"72-hour braised lamb ribs, walnut-herb gremolata, charcoal finish",ka:"72-საათიანი კრავი",ru:"72-часовая баранина"}, price:44, image:"https://images.unsplash.com/photo-1544025162-d76694265947?w=600&q=90", ingredients:["Lamb Ribs","Walnuts","Gremolata","Charcoal Ash"], badges:["Popular"], available:true, featured:false },
  { id:7, categoryId:4, name:{en:"Heritage Tomato",ka:"ძველი ჯიშის პომიდვრები",ru:"Помидоры Хэритедж"}, description:{en:"Seven-variety tomatoes, walnut-tarragon vinaigrette, pressed herb oil",ka:"შვიდი ჯიშის პომიდვრები",ru:"Семь сортов томатов с эстрагоном"}, price:19, image:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=90", ingredients:["Heritage Tomatoes","Walnuts","Tarragon","Red Onion","Herb Oil"], badges:["Seasonal"], available:true, featured:false },
  { id:8, categoryId:5, name:{en:"Churchkhela Parfait",ka:"ჩურჩხელა პარფე",ru:"Чурчхела Парфе"}, description:{en:"Deconstructed churchkhela, Kakhetian grape gelée, walnut praline",ka:"დეკონსტრუქცია ჩურჩხელა",ru:"Деконструированная чурчхела"}, price:18, image:"https://images.unsplash.com/photo-1587314168485-3236d6710814?w=600&q=90", ingredients:["Grape Must","Walnuts","Almond Praline","Vanilla"], badges:["New"], available:true, featured:false },
  { id:9, categoryId:6, name:{en:"Saperavi Reserve",ka:"საფერავი რეზერვი",ru:"Саперави Резерв"}, description:{en:"Single vineyard Kakheti, 2018 vintage, 48-month oak aged",ka:"ერთი ვენახი, 2018",ru:"Односортовой Саперави 2018"}, price:28, priceVariants:[{id:"bottle",label:{en:"1 bottle · 0.75 L",ka:"1 ბოთლი · 0,75 ლ",ru:"1 бутылка · 0,75 л"},price:55},{id:"glass",label:{en:"1 glass · 0.25 L",ka:"1 ჭიქა · 0,25 ლ",ru:"1 бокал · 0,25 л"},price:18}], image:"https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600&q=90", ingredients:["Saperavi","Kakheti","2018 Vintage","48-month Oak"], badges:["Popular","Signature"], available:true, featured:true },
  { id:10, categoryId:6, name:{en:"Rkatsiteli Natural",ka:"რქაწითელი",ru:"Ркацители Натурал"}, description:{en:"Amphora-aged skin-contact white, golden amber hue, stone fruit",ka:"ქვევრში მომწიფებული",ru:"Вино в амфоре"}, price:22, priceVariants:[{id:"bottle",label:{en:"1 bottle · 0.75 L",ka:"1 ბოთლი · 0,75 ლ",ru:"1 бутылка · 0,75 л"},price:42},{id:"glass",label:{en:"1 glass · 0.25 L",ka:"1 ჭიქა · 0,25 ლ",ru:"1 бокал · 0,25 л"},price:14}], image:"https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&q=90", ingredients:["Rkatsiteli","Amphora","Kakheti","Skin-Contact"], badges:["Rare"], available:true, featured:false },
];

const TABLES = [
  { id:1, name:"Table 01", zone:"Grand Hall", active:true },
  { id:2, name:"Table 02", zone:"Grand Hall", active:true },
  { id:3, name:"Salon Privé", zone:"VIP", active:true },
  { id:4, name:"Terrace I", zone:"Terrace", active:true },
  { id:5, name:"Terrace II", zone:"Terrace", active:false },
  { id:6, name:"Wine Cellar", zone:"Private", active:true },
];

/** Cart line key: `dishId` or `dishId::variantId` (price variants / local test). */
const CART_KEY_SEP = "::";

function dishPriceVariants(dish) {
  const v = dish?.priceVariants;
  if (!Array.isArray(v) || v.length === 0) return [];
  return v.filter((x) => x && x.id != null && String(x.id) !== "" && Number.isFinite(Number(x.price)));
}

function cartLineKey(dishId, variantId) {
  const id = String(dishId);
  if (variantId == null || variantId === "") return id;
  return `${id}${CART_KEY_SEP}${String(variantId)}`;
}

function parseCartLineKey(key) {
  const s = String(key);
  const i = s.indexOf(CART_KEY_SEP);
  if (i === -1) return { dishId: s, variantId: null };
  return { dishId: s.slice(0, i), variantId: s.slice(i + CART_KEY_SEP.length) };
}

function variantOptionLabel(v, lang) {
  if (!v) return "";
  if (typeof v.label === "string") return v.label.trim() || "—";
  const o = v.label && typeof v.label === "object" ? v.label : {};
  return String(o[lang] || o.en || o.ka || o.ru || "").trim() || "—";
}

function unitPriceForCartLine(dish, variantId) {
  if (!variantId) return Number(dish.price) || 0;
  const v = dishPriceVariants(dish).find((x) => String(x.id) === String(variantId));
  return v ? Number(v.price) || 0 : Number(dish.price) || 0;
}

function minMaxVariantPrice(dish) {
  const vars = dishPriceVariants(dish);
  if (vars.length === 0) return null;
  const prices = vars.map((x) => Number(x.price) || 0);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Multiline text for `type: "order"` staff notification (guest language for dish names). */
function formatOrderNotificationBody(cartLines, lang, tableLabel, grandTotal) {
  const title =
    lang === "ka" ? `შეკვეთა · ${tableLabel}` : lang === "ru" ? `Заказ · ${tableLabel}` : `Order · ${tableLabel}`;
  const lines = cartLines.map(({ dish, qty, lineTotal, variantLabelText }) => {
    const nameObj = dish?.name && typeof dish.name === "object" ? dish.name : {};
    const name = String(nameObj[lang] || nameObj.en || nameObj.ka || "—").trim();
    const varPart = variantLabelText ? ` · ${variantLabelText}` : "";
    return `• ${name}${varPart} × ${qty} — ₾${formatLari(lineTotal)}`;
  });
  const totalWord = lang === "ka" ? "ჯამი" : lang === "ru" ? "Итого" : "Total";
  return [title, "", ...lines, "", `${totalWord}: ₾${formatLari(grandTotal)}`].join("\n");
}

function notificationVisual(type) {
  if (type === "waiter") return { icon: "✦", accent: "var(--gold)", sheetBg: "rgba(61,191,176,0.15)", sheetBd: "rgba(61,191,176,0.35)" };
  if (type === "order") return { icon: "◎", accent: "#f59e0b", sheetBg: "rgba(245,158,11,0.18)", sheetBd: "rgba(245,158,11,0.45)" };
  if (type === "bill") return { icon: "◇", accent: "#a78bfa", sheetBg: "rgba(139,92,246,0.15)", sheetBd: "rgba(167,139,250,0.35)" };
  return { icon: "◌", accent: "var(--muted)", sheetBg: "rgba(255,255,255,0.06)", sheetBd: "rgba(255,255,255,0.12)" };
}

function staffNotificationLabel(type) {
  if (type === "waiter") return "მიმტანის გამოძახება";
  if (type === "order") return "შეკვეთა";
  if (type === "bill") return "ანგარიშის მოთხოვნა";
  return String(type || "");
}

function sumCartQtyForDish(cart, dishId) {
  const id = String(dishId);
  let sum = 0;
  for (const [k, qty] of Object.entries(cart)) {
    const { dishId: d } = parseCartLineKey(k);
    if (String(d) === id) sum += Number(qty) || 0;
  }
  return sum;
}

/** Shared across tabs so guest menu (/) and admin (/admin) see the same alerts. */
const NOTIF_STORAGE_KEY = "tiflisi_notifications_v1";

/** Staff session: last chosen seating zone (hall). */
const STAFF_ZONE_STORAGE_KEY = "tiflisi_staff_zone_v1";

function readStaffZoneSession(validZones) {
  if (!Array.isArray(validZones) || validZones.length === 0) return null;
  try {
    const raw = sessionStorage.getItem(STAFF_ZONE_STORAGE_KEY);
    if (!raw || !validZones.includes(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeStaffZoneSession(zone) {
  try {
    sessionStorage.setItem(STAFF_ZONE_STORAGE_KEY, String(zone));
  } catch {
    /* ignore */
  }
}

function clearStaffZoneSession() {
  try {
    sessionStorage.removeItem(STAFF_ZONE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function uniqueZonesFromTables(tables) {
  const set = new Set();
  for (const t of tables || []) {
    const z = typeof t?.zone === "string" && t.zone.trim() ? t.zone.trim() : "";
    if (z) set.add(z);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ka"));
}

/** სტუმრის მაგიდის დარბაზი — ჯერ შენახული ველი, შემდეგ მაგიდის ძიება. */
function resolveNotificationZone(n, tables) {
  if (n?.tableZone != null && String(n.tableZone).trim()) return String(n.tableZone).trim();
  const tid = n?.tableId;
  if (tid == null) return null;
  const row = (tables || []).find((t) => String(t.id) === String(tid));
  const z = row?.zone;
  return typeof z === "string" && z.trim() ? z.trim() : null;
}

/** Admin seating: persisted per browser (not in Supabase). */
const TABLES_STORAGE_KEY = "tiflisi_tables_v1";

/** Offline / no-Supabase: persist dish list so admin edits survive refresh (not used when live Supabase menu loads). */
const MENU_DISHES_STORAGE_KEY = "tiflisi_menu_dishes_v2";

function normalizeTableRows(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((t) => {
      if (!t || t.id == null || t.id === "") return null;
      const rawId = t.id;
      const id =
        typeof rawId === "number" && Number.isFinite(rawId)
          ? rawId
          : typeof rawId === "string" && /^[0-9]+$/.test(rawId.trim())
            ? Number(rawId.trim())
            : String(rawId).trim();
      const name = typeof t.name === "string" ? t.name.trim() : "";
      if (!name) return null;
      return {
        id,
        name,
        zone: typeof t.zone === "string" && t.zone.trim() ? t.zone.trim() : "Hall",
        active: t.active !== false,
      };
    })
    .filter(Boolean);
}

function loadTablesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(TABLES_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    const rows = normalizeTableRows(arr);
    return rows.length > 0 ? rows : null;
  } catch (_) {
    return null;
  }
}

function saveTablesToStorage(list) {
  try {
    localStorage.setItem(TABLES_STORAGE_KEY, JSON.stringify(list));
  } catch (_) {}
}

function loadDishesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(MENU_DISHES_STORAGE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr;
  } catch (_) {
    return null;
  }
}

function saveNotificationsToStorage(list) {
  try {
    const serializable = list.map((n) => ({
      ...n,
      time: n.time instanceof Date ? n.time.toISOString() : n.time,
    }));
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(serializable));
  } catch (_) {}
}

function loadNotificationsFromStorage() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((n) => n && typeof n === "object")
      .map((n) => ({
        ...n,
        time: n.time ? new Date(n.time) : new Date(),
        read: !!n.read,
      }));
  } catch (_) {
    return [];
  }
}

const BADGE_CFG = {
  "Signature":    { bg:"linear-gradient(135deg,#3dbfb0,#1a6b62)", color:"#ecfffb" },
  "Popular":      { bg:"linear-gradient(135deg,#a84830,#e07a62)", color:"#fff0eb" },
  "Chef's Table": { bg:"linear-gradient(135deg,#1a5c56,#2d8a7e)", color:"#d4f7f2" },
  "New":          { bg:"linear-gradient(135deg,#0d4a42,#3dbfb0)", color:"#d1fae5" },
  "Seasonal":     { bg:"linear-gradient(135deg,#1e4a45,#2fb89a)", color:"#dbeafe" },
  "Rare":         { bg:"linear-gradient(135deg,#5c2a22,#c45844)", color:"#ffe8e3" },
  "Dry":          { bg:"linear-gradient(135deg,#4a1d2e,#7c2d4a)", color:"#fce7f3" },
  "Semi-Dry":     { bg:"linear-gradient(135deg,#5c3d1a,#8b6914)", color:"#fff8e7" },
  "Semi-Sweet":   { bg:"linear-gradient(135deg,#4a2a4a,#7c3d6b)", color:"#fdf4ff" },
};

const T = {
  en:{menu:"Menu",callWaiter:"Summon Waiter",requestBill:"Request Bill",ingredients:"Provenance",soldOut:"Unavailable",table:"Table",waiterCalled:"Your waiter is on the way.",billRequested:"Your bill is being prepared.",search:"Search the menu…",all:"All",adminLogin:"Staff Access",login:"Enter",dashboard:"Overview",menuMgmt:"Cuisine",tables:"Seating",notifications:"Alerts",analytics:"Insights",logout:"Exit",addDish:"New Dish",save:"Save",cancel:"Cancel",available:"Available",featured:"Recommended",chefChoice:"Chef's choice",badges:"Distinctions",badgeDry:"Dry",badgeSemiDry:"Semi-Dry",badgeSemiSweet:"Semi-Sweet",chooseOptions:"Choose size",cart:"Basket",cartTotal:"Total",addToCart:"Add",cartHint:"Estimated total for your selection (reference only).",emptyCart:"Your basket is empty.",cartQty:"Qty",cartClose:"Close",submitOrder:"Submit order",confirmOrderTitle:"Send this order?",confirmOrderBody:"Staff will receive your table order in alerts (amount is indicative — confirm at the venue).",confirmOrderBtn:"Confirm & send",orderSent:"Order sent."},
  ka:{menu:"მენიუ",callWaiter:"მიმტანის გამოძახება",requestBill:"ანგარიშის მოთხოვნა",ingredients:"წარმომავლობა",soldOut:"მიუწვდომელი",table:"მაგიდა",waiterCalled:"მიმტანი მოდის.",billRequested:"ანგარიში მზადდება.",search:"მოძებნეთ…",all:"ყველა",adminLogin:"პერსონალი",login:"შესვლა",dashboard:"მიმოხილვა",menuMgmt:"სამზარეულო",tables:"მოსასვლელი",notifications:"შეტყობინებები",analytics:"ანალიტიკა",logout:"გამოსვლა",addDish:"ახალი კერძი",save:"შენახვა",cancel:"გაუქმება",available:"ხელმისაწვდომი",featured:"რეკომენდებული",chefChoice:"შეფის არჩევანი",badges:"გამოჩენილი",badgeDry:"მშრალი",badgeSemiDry:"ნახევრადმშრალი",badgeSemiSweet:"ნახევრადტკბილი",chooseOptions:"ზომა / ფასი",cart:"კალათა",cartTotal:"ჯამი",addToCart:"დამატება",cartHint:"არჩეული კერძების სავარაუდო ჯამი (საინფორმაციოდ).",emptyCart:"კალათა ცარიელია.",cartQty:"რაოდ.",cartClose:"დახურვა",submitOrder:"შეკვეთის გაგზავნა",confirmOrderTitle:"გავაგზავნოთ შეკვეთა?",confirmOrderBody:"პერსონალი მიიღებს შეკვეთას შეტყობინებაში (ჯამი საინფორმაციოა — დაადასტურეთ ადგილზე).",confirmOrderBtn:"დადასტურება",orderSent:"შეკვეთა გაიგზავნა."},
  ru:{menu:"Меню",callWaiter:"Позвать Официанта",requestBill:"Попросить Счёт",ingredients:"Происхождение",soldOut:"Недоступно",table:"Стол",waiterCalled:"Официант уже идёт.",billRequested:"Счёт готовится.",search:"Поиск…",all:"Все",adminLogin:"Персонал",login:"Войти",dashboard:"Обзор",menuMgmt:"Кухня",tables:"Места",notifications:"Оповещения",analytics:"Аналитика",logout:"Выйти",addDish:"Новое Блюдо",save:"Сохранить",cancel:"Отмена",available:"Доступно",featured:"Рекомендуем",chefChoice:"Выбор шефа",badges:"Отличия",badgeDry:"Сухое",badgeSemiDry:"Полусухое",badgeSemiSweet:"Полусладкое",chooseOptions:"Размер и цена",cart:"Корзина",cartTotal:"Итого",addToCart:"В корзину",cartHint:"Ориентировочная сумма выбранных блюд (справочно).",emptyCart:"Корзина пуста.",cartQty:"Кол-во",cartClose:"Закрыть",submitOrder:"Отправить заказ",confirmOrderTitle:"Отправить заказ?",confirmOrderBody:"Персонал получит заказ в оповещениях (сумма ориентировочная — уточните у официанта).",confirmOrderBtn:"Подтвердить",orderSent:"Заказ отправлен."},
};

/* ─── SHARED STATE ───────────────────────────────────────────────────────── */
function useStore() {
  const supabaseEnabled = isSupabaseConfigured();
  const [categories, setCategories] = useState(() => (supabaseEnabled ? [] : CATEGORIES));
  const [dishes, setDishes] = useState(() => {
    if (supabaseEnabled) return [];
    return loadDishesFromLocalStorage() ?? DISHES;
  });
  const [menuLoading, setMenuLoading] = useState(supabaseEnabled);
  const [menuError, setMenuError] = useState(null);
  const [tables, setTables] = useState(() => (supabaseEnabled ? [] : (loadTablesFromLocalStorage() ?? TABLES)));
  const [tablesLoading, setTablesLoading] = useState(!!supabaseEnabled);
  const [tablesError, setTablesError] = useState(null);
  const [notifications, setNotificationsState] = useState(() =>
    isSupabaseConfigured() ? [] : loadNotificationsFromStorage()
  );
  const [analytics, setAnalytics] = useState({ scans: 247, views: { 1:18, 2:24, 3:31, 5:42, 9:28 } });

  const setNotifications = useCallback((updater) => {
    setNotificationsState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!supabaseEnabled) {
        saveNotificationsToStorage(next);
      } else if (supabase) {
        const prevSnap = prev;
        queueMicrotask(() => {
          syncNotificationsToSupabase(prevSnap, next).catch((err) => console.warn("[service_alerts]", err));
        });
      }
      return next;
    });
  }, [supabaseEnabled]);

  const addNotification = useCallback(
    async (note) => {
      if (supabaseEnabled && supabase) {
        try {
          const row = await insertServiceAlert(note);
          setNotificationsState((prev) => {
            if (prev.some((n) => String(n.id) === String(row.id))) return prev;
            return [row, ...prev].slice(0, 100);
          });
          return;
        } catch (e) {
          console.warn("service_alerts insert failed, using localStorage", e);
        }
      }
      setNotificationsState((prev) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const row = { ...note, id, time: new Date(), read: false };
        const next = [row, ...prev].slice(0, 60);
        saveNotificationsToStorage(next);
        return next;
      });
    },
    [supabaseEnabled]
  );

  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== NOTIF_STORAGE_KEY || e.newValue == null) return;
      try {
        const arr = JSON.parse(e.newValue);
        if (!Array.isArray(arr)) return;
        const next = arr.map((n) => ({
          ...n,
          time: n.time ? new Date(n.time) : new Date(),
          read: !!n.read,
        }));
        setNotificationsState(next);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [supabaseEnabled]);

  /** Supabase: პირველი ჩატვირთვა + პოლინგი + ტაბზე დაბრუნება — მობილურზე Realtime ხშირად იშლება ფონში. */
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    let cancelled = false;

    const pull = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      fetchServiceAlerts(100)
        .then((rows) => {
          if (!cancelled) setNotificationsState(rows);
        })
        .catch((e) => console.warn("[service_alerts] poll", e));
    };

    pull();

    const intervalMs = 10000;
    const id = window.setInterval(pull, intervalMs);

    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    const onFocus = () => pull();
    const onOnline = () => pull();
    /** iOS Safari: ბრაუზერში უკან დაბრუნება / bfcache */
    const onPageShow = (e) => {
      if (e.persisted) pull();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    const ch = supabase
      .channel("service_alerts_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_alerts" },
        (payload) => {
          const row = rowToNotification(payload.new);
          if (!row) return;
          setNotificationsState((prev) => {
            if (prev.some((n) => String(n.id) === String(row.id))) return prev;
            return [row, ...prev].slice(0, 100);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "service_alerts" },
        (payload) => {
          const row = rowToNotification(payload.new);
          if (!row) return;
          setNotificationsState((prev) =>
            prev.map((n) => (String(n.id) === String(row.id) ? { ...n, ...row, time: row.time } : n))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "service_alerts" },
        (payload) => {
          const id = payload.old?.id;
          if (id == null) return;
          setNotificationsState((prev) => prev.filter((n) => String(n.id) !== String(id)));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabaseEnabled]);

  const trackView = useCallback((id) => {
    const key = id == null ? "" : String(id);
    if (!key) return;
    setAnalytics((prev) => ({
      ...prev,
      scans: prev.scans + 1,
      views: { ...prev.views, [key]: (prev.views[key] || 0) + 1 },
    }));
  }, []);

  const clearMenuError = useCallback(() => setMenuError(null), []);

  const reloadMenuFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    setMenuLoading(true);
    setMenuError(null);
    const reasonText = (settled) => {
      const x = settled?.reason;
      if (x instanceof Error) return x.message;
      if (typeof x === "string") return x;
      if (x != null && typeof x === "object" && "message" in x) return String(x.message);
      return x != null ? String(x) : "";
    };
    const [dishResult, catResult] = await Promise.allSettled([fetchMenuDishes(), fetchMenuCategories()]);
    let dishErr = null;
    if (dishResult.status === "fulfilled") {
      setDishes(dishResult.value);
    } else {
      dishErr = reasonText(dishResult) || "Could not load menu";
      setDishes([]);
    }
    if (catResult.status === "fulfilled") {
      setCategories(catResult.value);
    } else {
      setCategories([]);
      if (!dishErr) {
        dishErr =
          reasonText(catResult) || "Could not load menu categories (run SQL for public.menu_categories)";
      }
    }
    setMenuError(dishErr || null);
    setMenuLoading(false);
  }, []);

  const reloadSeatingFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured() || !supabase) return;
    setTablesError(null);
    try {
      const rows = await fetchSeatingTables();
      setTables(rows);
    } catch (e) {
      setTablesError(e?.message || "Could not load seating");
      setTables(TABLES);
    }
  }, []);

  const addTableRow = useCallback(
    async (name, zone) => {
      if (!supabaseEnabled) {
        setTables((p) => [...p, { id: Date.now(), name: String(name).trim(), zone, active: true }]);
        return;
      }
      await insertSeatingTable({ name, zone });
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, reloadSeatingFromSupabase]
  );

  const toggleTableRow = useCallback(
    async (id) => {
      if (!supabaseEnabled) {
        setTables((p) => p.map((t) => (String(t.id) === String(id) ? { ...t, active: !t.active } : t)));
        return;
      }
      const row = tables.find((t) => String(t.id) === String(id));
      if (!row) return;
      await updateSeatingTable(id, { active: !row.active });
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, tables, reloadSeatingFromSupabase]
  );

  const removeTableRow = useCallback(
    async (id) => {
      if (!supabaseEnabled) {
        setTables((p) => p.filter((t) => String(t.id) !== String(id)));
        return;
      }
      await deleteSeatingTable(id);
      await reloadSeatingFromSupabase();
    },
    [supabaseEnabled, reloadSeatingFromSupabase]
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    reloadMenuFromSupabase();
  }, [supabaseEnabled, reloadMenuFromSupabase]);

  /** Offline only: persist dishes in localStorage (never when Supabase env is set). */
  useEffect(() => {
    if (supabaseEnabled) return;
    try {
      localStorage.setItem(MENU_DISHES_STORAGE_KEY, JSON.stringify(dishes));
    } catch (_) {}
  }, [dishes, supabaseEnabled]);

  /** Offline: other tabs pick up localStorage menu changes. */
  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== MENU_DISHES_STORAGE_KEY || e.newValue == null) return;
      try {
        const arr = JSON.parse(e.newValue);
        if (!Array.isArray(arr)) return;
        setDishes(arr);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [supabaseEnabled]);

  useEffect(() => {
    if (supabaseEnabled) return;
    saveTablesToStorage(tables);
  }, [tables, supabaseEnabled]);

  useEffect(() => {
    if (supabaseEnabled) return;
    const onStorage = (e) => {
      if (e.key !== TABLES_STORAGE_KEY || e.newValue == null) return;
      try {
        const rows = normalizeTableRows(JSON.parse(e.newValue));
        if (rows.length > 0) setTables(rows);
      } catch (_) {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [supabaseEnabled]);

  /** Supabase: load seating + optional Realtime sync (enable `seating` in Replication if updates do not propagate). */
  useEffect(() => {
    if (!supabaseEnabled || !supabase) return;
    let cancelled = false;
    setTablesLoading(true);
    setTablesError(null);
    fetchSeatingTables()
      .then((rows) => {
        if (!cancelled) setTables(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          setTablesError(e?.message || "Seating load failed");
          setTables(TABLES);
        }
      })
      .finally(() => {
        if (!cancelled) setTablesLoading(false);
      });

    const ch = supabase
      .channel("seating_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "seating" },
        () => {
          fetchSeatingTables()
            .then((rows) => {
              if (!cancelled) setTables(rows);
            })
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [supabaseEnabled]);

  return {
    categories,
    setCategories,
    dishes,
    setDishes,
    tables,
    tablesLoading,
    tablesError,
    addTableRow,
    toggleTableRow,
    removeTableRow,
    reloadSeatingFromSupabase,
    notifications,
    setNotifications,
    addNotification,
    analytics,
    trackView,
    menuLoading,
    menuError,
    clearMenuError,
    reloadMenuFromSupabase,
  };
}

/** Guest menu — header links (override with VITE_LINK_* in .env.local). */
const SOCIAL_TOP_ITEMS = [
  {
    env: "VITE_LINK_FACEBOOK",
    label: "Facebook",
    brand: "facebook",
    fallback: "https://www.facebook.com/TiflisiRestaurantBatumi/",
    bg: "#1877F2",
    border: "#1877F2",
    mode: "icon",
  },
  {
    env: "VITE_LINK_INSTAGRAM",
    label: "Instagram",
    brand: "instagram",
    fallback: "https://www.instagram.com/tiflisirestaurantbatumi/",
    bg: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
    border: "rgba(255,255,255,0.25)",
    mode: "icon",
  },
  {
    env: "VITE_LINK_GOOGLE",
    label: "Google Reviews",
    brand: "google",
    fallback: "https://g.page/r/CcKkKc1ypmCgEAE/review",
    bg: "#4285F4",
    border: "#4285F4",
    mode: "icon",
  },
  {
    env: "VITE_LINK_TRIPADVISOR",
    label: "Tripadvisor Review",
    brand: "tripadvisor",
    fallback:
      "https://www.tripadvisor.com/UserReviewEdit-g297576-d25448146-Restaurant_Tiflisi-Batumi_Adjara_Region.html",
    bg: "#00AF87",
    border: "#00AF87",
    mode: "icon",
  },
  {
    env: "VITE_LINK_WOLT",
    label: "Wolt",
    fallback:
      "https://wolt.com/en/geo/batumi/restaurant/restaurant-tiflis",
    bg: "#009FE3",
    border: "#0088c7",
    fg: "#ffffff",
    text: "Wolt",
    mode: "text",
  },
  {
    env: "VITE_LINK_GLOVO",
    label: "Glovo",
    fallback:
      "https://glovoapp.com/en/ge/batumi/stores/tiflisi-bat?content=pitsa-c.1421345036&section=pitsa-s.2999510380",
    bg: "#FDBF00",
    border: "#E5AC00",
    fg: "#1a1204",
    text: "Glovo",
    mode: "text",
  },
  {
    env: "VITE_LINK_BOLT",
    label: "Bolt Food",
    fallback: "https://food.bolt.eu/ka-ge/38-batumi/p/67460-restorani-tiplisi/",
    bg: "#34D186",
    border: "#2ABF75",
    fg: "#041012",
    text: "Bolt",
    mode: "text",
  },
];

function socialTopHref(envKey, fallback) {
  const v = import.meta.env[envKey];
  if (v != null && String(v).trim() !== "") return String(v).trim();
  return fallback;
}

/** Solid accent for glow / icon tint (SOCIAL_TOP_ITEMS border/bg may be gradient). */
function socialAccentFromItem(item) {
  if (typeof item.border === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(item.border)) return item.border;
  if (item.brand === "instagram") return "#E1306C";
  if (item.brand === "facebook") return "#1877F2";
  if (item.brand === "google" || item.brand === "googlemaps") return "#4285F4";
  if (item.brand === "tripadvisor") return "#00AF87";
  return "#3dbfb0";
}

function SocialTopStrip({ className = "" }) {
  const iconBase = "https://cdn.jsdelivr.net/npm/simple-icons@11.6.0/icons";
  return (
    <div className={["social-top-strip", className].filter(Boolean).join(" ")} role="navigation" aria-label="Social & delivery">
      {SOCIAL_TOP_ITEMS.map((item) => {
        const href = socialTopHref(item.env, item.fallback);
        const isText = item.mode === "text";
        const accent = socialAccentFromItem(item);
        const iconUrl = `${iconBase}/${item.brand}.svg`;
        const useGradientIcon = !isText && typeof item.bg === "string" && item.bg.includes("gradient");
        return (
          <a
            key={item.env}
            className={`social-top-link ${isText ? "social-top-link--text" : "social-top-link--icon"}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={item.label}
            aria-label={item.label}
            style={{
              ["--social-accent"]: accent,
              ["--social-icon-url"]: `url("${iconUrl}")`,
              ...(useGradientIcon ? { ["--social-icon-gradient"]: item.bg } : {}),
            }}
          >
            {isText ? (
              item.text
            ) : (
              <span
                className={`social-top-link__icon-mask${useGradientIcon ? " social-top-link__icon-mask--gradient" : ""}`}
                aria-hidden="true"
              />
            )}
          </a>
        );
      })}
    </div>
  );
}

/** Menusa-style modal: pick a price variant then add to cart (local demo + future Supabase `priceVariants`). */
function DishVariantModal({ dish, lang, t, onClose, onConfirm }) {
  const vars = useMemo(() => dishPriceVariants(dish), [dish]);
  const [selId, setSelId] = useState(() => String(vars[0]?.id ?? ""));

  useEffect(() => {
    const v0 = dishPriceVariants(dish)[0];
    setSelId(v0 != null ? String(v0.id) : "");
  }, [dish]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selected = vars.find((x) => String(x.id) === selId) || vars[0];
  const selPrice = selected ? Number(selected.price) || 0 : 0;
  const nameObj = dish?.name && typeof dish.name === "object" ? dish.name : {};
  const title = String(nameObj[lang] || nameObj.en || nameObj.ka || "—").trim() || "—";

  return (
    <>
      <button
        type="button"
        aria-label={t.cartClose}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10140,
          border: "none",
          padding: 0,
          margin: 0,
          background: "rgba(0,0,0,0.78)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dish-variant-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10150,
          width: "min(520px, calc(100vw - 24px))",
          maxHeight: "min(88vh, 640px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
          border: "1px solid rgba(201,169,98,0.25)",
          background: "linear-gradient(165deg, rgba(18,28,26,0.98), rgba(8,12,12,0.99))",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flex: 1,
            minHeight: 0,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              flex: "1 1 200px",
              minWidth: 180,
              maxHeight: 280,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px",
            }}
          >
            {dish.image ? (
              <img
                src={dish.image}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "260px", objectFit: "contain" }}
              />
            ) : (
              <div style={{ color: "var(--muted)", fontSize: "12px" }}>—</div>
            )}
          </div>
          <div style={{ flex: "1 1 240px", minWidth: 0, display: "flex", flexDirection: "column", padding: "18px 18px 16px", position: "relative" }}>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.cartClose}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.35)",
                color: "var(--cream)",
                cursor: "pointer",
                fontSize: "16px",
                lineHeight: 1,
              }}
            >
              ×
            </button>
            <h2
              id="dish-variant-modal-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(1.1rem, 3.5vw, 1.35rem)",
                fontWeight: 600,
                color: "var(--cream)",
                margin: "0 40px 14px 0",
                lineHeight: 1.25,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {title}
            </h2>
            <div style={{ fontSize: "9px", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--gold)", marginBottom: "10px" }}>{t.chooseOptions}</div>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
              {vars.map((v) => {
                const active = String(v.id) === selId;
                const lab = variantOptionLabel(v, lang);
                const pr = Number(v.price) || 0;
                return (
                  <label
                    key={String(v.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      border: active ? "1px solid rgba(139,92,246,0.55)" : "1px solid rgba(255,255,255,0.08)",
                      background: active ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <input
                      type="radio"
                      name="dish-variant"
                      checked={active}
                      onChange={() => setSelId(String(v.id))}
                      style={{ accentColor: "#a78bfa", width: 18, height: 18, flexShrink: 0 }}
                    />
                    <span style={{ flex: 1, fontSize: "13px", color: "rgba(244,241,234,0.92)", fontFamily: "var(--font-body)" }}>{lab}</span>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: "17px", color: "var(--gold-light)", flexShrink: 0 }}>₾{formatLari(pr)}</span>
                  </label>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!selected}
              onClick={() => {
                if (selected) onConfirm(String(selected.id));
              }}
              style={{
                marginTop: "16px",
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "none",
                cursor: selected ? "pointer" : "not-allowed",
                opacity: selected ? 1 : 0.5,
                fontFamily: "var(--font-body)",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#faf5ff",
                background: "linear-gradient(135deg, #6d28d9, #7c3aed)",
                boxShadow: "0 8px 28px rgba(109,40,217,0.35)",
              }}
            >
              {t.addToCart} · ₾{formatLari(selPrice)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CUSTOMER MENU
═══════════════════════════════════════════════════════════════════════════ */
function CustomerMenu({ tableId, store, lang }) {
  const t = T[lang];
  const { categories, dishes, tables, addNotification, trackView, menuLoading, menuError } = store;
  const supabaseMenu = isSupabaseConfigured();
  const [activeCat, setActiveCat] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  /** Dish with `priceVariants` — open picker modal (local + future DB). */
  const [variantModalDish, setVariantModalDish] = useState(null);
  const catRefs = useRef({});
  const headerRef = useRef(null);
  const catScrollRef = useRef(null);
  const menuTopRef = useRef(null);
  const skipScrollSpyRef = useRef(false);
  const chipCenterRequestedRef = useRef(false);
  const table = tables.find((tb) => String(tb.id) === String(tableId)) || { name: `Table ${tableId}`, zone: "Hall" };

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([key, qty]) => ({ key, qty: Number(qty) || 0 }))
      .filter(({ qty }) => qty > 0)
      .map(({ key, qty }) => {
        const { dishId, variantId } = parseCartLineKey(key);
        const dish = dishes.find((d) => String(d.id) === String(dishId));
        if (!dish || !dish.available) return null;
        const unit = unitPriceForCartLine(dish, variantId);
        const unitCents = priceToCents(unit);
        const lineTotal = (unitCents * qty) / 100;
        const vRow = variantId ? dishPriceVariants(dish).find((x) => String(x.id) === String(variantId)) : null;
        const variantLabelText = vRow ? variantOptionLabel(vRow, lang) : "";
        return { key, dish, qty, lineTotal, unitPrice: unit, variantLabelText };
      })
      .filter(Boolean);
  }, [cart, dishes, lang]);

  const cartGrandTotal = useMemo(
    () => cartLines.reduce((s, l) => s + priceToCents(l.unitPrice) * l.qty, 0) / 100,
    [cartLines]
  );
  const cartItemCount = useMemo(() => cartLines.reduce((s, l) => s + l.qty, 0), [cartLines]);

  const addToCart = useCallback((dish, variantId) => {
    if (!dish?.available) return;
    const vid = variantId != null && variantId !== "" ? String(variantId) : null;
    const key = cartLineKey(dish.id, vid);
    setCart((c) => ({ ...c, [key]: (c[key] || 0) + 1 }));
  }, []);

  const bumpCartQty = useCallback((lineKey, delta) => {
    setCart((c) => {
      const prev = c[lineKey] || 0;
      const next = prev + delta;
      if (next <= 0) {
        const { [lineKey]: _, ...rest } = c;
        return rest;
      }
      return { ...c, [lineKey]: next };
    });
  }, []);

  useEffect(() => {
    if (cartItemCount === 0) setCartOpen(false);
  }, [cartItemCount]);

  useEffect(() => {
    if (!cartOpen) setOrderConfirmOpen(false);
  }, [cartOpen]);

  /** Drop cart lines for dishes removed from the menu (e.g. after Supabase reload). */
  useEffect(() => {
    if (dishes.length === 0) return;
    const ids = new Set(dishes.map((d) => String(d.id)));
    setCart((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const k of Object.keys(next)) {
        const { dishId } = parseCartLineKey(k);
        if (!ids.has(dishId)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [dishes]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const confirmSendOrder = useCallback(() => {
    if (cartLines.length === 0) return;
    const body = formatOrderNotificationBody(cartLines, lang, table.name, cartGrandTotal);
    addNotification({ type: "order", tableId, tableName: table.name, tableZone: table.zone, message: body });
    setCart({});
    setOrderConfirmOpen(false);
    setCartOpen(false);
    setToast(t.orderSent);
    window.setTimeout(() => setToast(null), 3500);
  }, [cartLines, lang, table.name, cartGrandTotal, tableId, addNotification, t.orderSent]);

  const callWaiter = () => {
    addNotification({ type: "waiter", tableId, tableName: table.name, tableZone: table.zone, message: "Waiter Request" });
    showToast(t.waiterCalled);
  };
  const requestBill = () => {
    addNotification({ type: "bill", tableId, tableName: table.name, tableZone: table.zone, message: "Bill Request" });
    showToast(t.billRequested);
  };

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);

  const ORPHAN_CAT_KEY = "__orphan__";
  const MENU_TOP_SECTION_ID = "menu-section-top";
  const sectionIdForCategory = (catId) =>
    catId === ORPHAN_CAT_KEY ? "menu-section-orphan" : `menu-section-${String(catId)}`;

  const searchQuery = useMemo(() => search.trim().toLowerCase(), [search]);

  /** Search only — category chips scroll to section (no hide-other-categories; avoids wrong scroll after filter). */
  const filtered = useMemo(() => {
    const q = searchQuery;
    return dishes.filter((d) => {
      const nm = d?.name && typeof d.name === "object" ? d.name : {};
      const label = String(nm[lang] || nm.en || "").toLowerCase();
      return !q || label.includes(q);
    });
  }, [dishes, searchQuery, lang]);

  const grouped = useMemo(() => {
    const byOrder = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id));
    const base = sortedCategories
      .map((cat) => ({
        ...cat,
        dishes: filtered.filter((d) => sameCategoryId(d.categoryId, cat.id)).sort(byOrder),
      }));
    const visibleBase = searchQuery ? base.filter((c) => c.dishes.length > 0) : base;
    const orphan = filtered
      .filter((d) => !sortedCategories.some((c) => sameCategoryId(c.id, d.categoryId)))
      .sort(byOrder);
    if (orphan.length === 0) return visibleBase;
    return [
      ...visibleBase,
      {
        id: ORPHAN_CAT_KEY,
        name: { en: "Other", ka: "სხვა", ru: "Прочее" },
        icon: "◇",
        order: 999999,
        dishes: orphan,
      },
    ];
  }, [sortedCategories, filtered, searchQuery]);

  const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stickyOffset = () => (headerRef.current?.offsetHeight ?? 120) + 12;

  const scrollToSection = useCallback((sectionId) => {
    if (typeof document === "undefined") return false;
    const element = document.getElementById(sectionId);
    if (!element) return false;
    element.style.scrollMarginTop = `${stickyOffset()}px`;
    const top = window.scrollY + element.getBoundingClientRect().top - stickyOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    return true;
  }, []);

  const scrollTo = useCallback((id) => {
    skipScrollSpyRef.current = true;
    chipCenterRequestedRef.current = true;
    setActiveCat(id);
    const sectionId = sectionIdForCategory(id);

    let tries = 0;
    const tryScroll = () => {
      if (scrollToSection(sectionId)) return;
      // Sections can mount a frame later right after filter / state transitions.
      tries += 1;
      if (tries < 12) requestAnimationFrame(tryScroll);
    };
    tryScroll();

    window.setTimeout(() => {
      skipScrollSpyRef.current = false;
    }, 950);
  }, [scrollToSection]);

  const scrollToMenuTop = useCallback(() => {
    skipScrollSpyRef.current = true;
    chipCenterRequestedRef.current = true;
    setActiveCat(null);
    if (!scrollToSection(MENU_TOP_SECTION_ID)) {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
    window.setTimeout(() => {
      skipScrollSpyRef.current = false;
    }, 950);
  }, [scrollToSection]);

  /** Sync active category chip with scroll position (spy). */
  useEffect(() => {
    const updateActiveFromScroll = () => {
      if (skipScrollSpyRef.current) return;
      const nav = headerRef.current;
      if (!nav) return;
      const line = nav.getBoundingClientRect().bottom + 10;
      let current = grouped[0]?.id ?? null;
      for (const cat of grouped) {
        const el = catRefs.current[String(cat.id)];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= line) current = cat.id;
      }
      const nearBottom =
        typeof window !== "undefined" &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (nearBottom && grouped.length > 0) {
        current = grouped[grouped.length - 1].id;
      }
      setActiveCat((prev) => (String(prev) === String(current) ? prev : current));
    };

    let raf = 0;
    const onScrollOrResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateActiveFromScroll();
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    updateActiveFromScroll();
    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [grouped]);

  /** Keep chip strip stable while page scrolls; center chip only for explicit clicks. */
  useLayoutEffect(() => {
    if (!chipCenterRequestedRef.current) return;
    chipCenterRequestedRef.current = false;
    const wrap = catScrollRef.current;
    if (!wrap) return;
    const key = activeCat == null ? "all" : String(activeCat);
    const esc = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(key) : key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const btn = wrap.querySelector(`[data-cat-tab="${esc}"]`);
    if (btn) {
      const targetLeft = btn.offsetLeft - (wrap.clientWidth - btn.offsetWidth) / 2;
      wrap.scrollTo({ left: Math.max(0, targetLeft), behavior: "auto" });
    }
  }, [activeCat]);

  return (
    <div className="menu-page-shell" style={{ color:"var(--cream)", fontFamily:"var(--font-body)" }}>
      <div className="noise" />

      {/* HERO — compact, matches welcome luxury language */}
      <div className="menu-hero-strip">
        <div style={{ position:"relative", zIndex:3, height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", paddingTop:"12px", animation:"fadeIn 0.9s ease" }}>
          <div style={{ fontSize:"9px", letterSpacing:"0.55em", color:"#c9a962", textTransform:"uppercase", marginBottom:"8px", fontFamily:"var(--font-body)", fontWeight:600 }}>
            Georgian fine dining
          </div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"clamp(36px,9vw,56px)", fontWeight:300, color:"var(--cream)", letterSpacing:"0.06em", lineHeight:1, fontStyle:"italic" }}>
            Tiflisi
          </div>
          <div style={{ marginTop:"10px", display:"flex", alignItems:"center", gap:"12px" }}>
            <div style={{ width:"36px", height:"1px", background:"linear-gradient(90deg, transparent, rgba(201,169,98,0.6))" }} />
            <span style={{ fontSize:"9px", color:"rgba(109,143,137,0.95)", letterSpacing:"0.28em", textTransform:"uppercase" }}>{t.table} · {table.name}</span>
            <div style={{ width:"36px", height:"1px", background:"linear-gradient(90deg, rgba(201,169,98,0.6), transparent)" }} />
          </div>
        </div>
      </div>

      {/* STICKY NAV */}
      <div ref={headerRef} className="menu-sticky-nav" style={{ position: "sticky", top: 0, zIndex: 100, overflowAnchor: "none" }}>
        <div className="menu-sticky-nav-inner">
          <div className="menu-search-wrap">
            <span className="menu-search-icon" aria-hidden="true">✦</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="menu-search-input"
            />
          </div>

          <div ref={catScrollRef} className="menu-cat-scroll">
            <CatBtn
              tabKey="all"
              active={!activeCat}
              onClick={scrollToMenuTop}
              label={t.all}
            />
            {/* One chip per rendered section only — was sortedCategories (orphan sections missing → scroll found no el). */}
            {grouped.map((c) => (
              <CatBtn
                key={c.id}
                tabKey={c.id}
                active={activeCat != null && String(activeCat) === String(c.id)}
                onClick={() => scrollTo(c.id)}
                label={c.id === ORPHAN_CAT_KEY ? (lang === "ka" ? "სხვა" : lang === "ru" ? "Прочее" : "Other") : c.name[lang]}
                icon={c.icon}
              />
            ))}
          </div>
        </div>
      </div>

      {menuError && (
        <div style={{ margin:"0 16px 12px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", letterSpacing:"0.2px", lineHeight:1.5 }}>
          {menuError}
        </div>
      )}

      {/* DISH SECTIONS — bottom padding clears fixed dock + home indicator */}
      <div
        ref={menuTopRef}
        id={MENU_TOP_SECTION_ID}
        className={`menu-main-column${cartItemCount > 0 ? " menu-main-column--cart" : ""}`}
        style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}
      >
        {menuLoading && dishes.length === 0 && (
          <div style={{ textAlign:"center", padding:"80px 20px", fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--muted)" }}>
            Loading menu…
          </div>
        )}
        {!menuLoading && dishes.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 20px", fontSize:"13px", color:"var(--muted)", lineHeight:1.6 }}>
            {supabaseMenu
              ? "მენიუ იტვირთება Supabase-იდან — ცარიელია ან ჩატვირთვა ვერ მოხერხდა. შეამოწმე SQL/RLS ან დაამატე კერძები Admin → Cuisine / Cloud-იდან."
              : <>No dishes to show. Add dishes in <strong style={{ color:"var(--cream)" }}>Admin → Cuisine</strong> (stored in this browser) or enable Supabase.</>}
          </div>
        )}
        {grouped.map((cat, gi) => (
          <div
            key={cat.id}
            id={sectionIdForCategory(cat.id)}
            className="menu-cat-section-anchor"
            ref={(el) => {
              const k = String(cat.id);
              if (el) catRefs.current[k] = el;
              else delete catRefs.current[k];
            }}
            style={{ marginTop: gi === 0 ? 28 : 44 }}
          >
            <div className="menu-section-head">
              <span className="menu-section-icon" aria-hidden="true">{cat.icon}</span>
              <h2 className="menu-section-title">{cat.name[lang]}</h2>
              <div className="menu-section-line" aria-hidden="true" />
            </div>
            <div className="menu-dish-list">
              {cat.dishes.map((dish, di) => (
                <DishRow key={dish.id} dish={dish} lang={lang} t={t}
                  style={{ animationDelay:`${(gi*3+di)*0.06}s` }}
                  expanded={expanded===dish.id}
                  onToggle={() => { setExpanded(expanded===dish.id?null:dish.id); trackView(dish.id); }}
                  cartQty={sumCartQtyForDish(cart, dish.id)}
                  onAddToCart={addToCart}
                  onBumpCartQty={bumpCartQty}
                  onOpenVariantModal={(d) => setVariantModalDish(d)} />
              ))}
              {cat.dishes.length === 0 && (
                <div style={{ padding:"10px 4px 2px", color:"var(--muted)", fontSize:"11px", letterSpacing:"0.03em" }}>
                  {lang === "ka"
                    ? "ამ ჯგუფში კერძები ჯერ არ დამატებულა."
                    : lang === "ru"
                      ? "В этой категории пока нет блюд."
                      : "No dishes in this category yet."}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ marginTop:"56px", textAlign:"center", padding:"32px 0 8px" }}>
          <div style={{ width:"1px", height:"36px", background:"linear-gradient(180deg,transparent,rgba(201,169,98,0.55),transparent)", margin:"0 auto 14px" }} />
          <div style={{ fontFamily:"var(--font-display)", fontSize:"12px", color:"rgba(109,143,137,0.9)", fontStyle:"italic", letterSpacing:"0.12em" }}>
            All dishes prepared with the finest Georgian ingredients
          </div>
        </div>
      </div>

      {/* CART SHEET */}
      {cartOpen && (
        <>
          <button
            type="button"
            aria-label={t.cartClose}
            onClick={() => setCartOpen(false)}
            style={{
              position:"fixed", inset:0, zIndex:10120, border:"none", padding:0, margin:0,
              background:"rgba(0,0,0,0.72)", cursor:"pointer", WebkitTapHighlightColor:"transparent",
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-sheet-title"
            className="menu-cart-sheet"
            style={{
              position:"fixed", left:0, right:0, bottom:0, zIndex:10130, maxHeight:"72vh",
              borderRadius:"20px 20px 0 0",
              display:"flex", flexDirection:"column", animation:"menuSheetUp 0.36s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
              <div id="cart-sheet-title" style={{ fontFamily:"var(--font-display)", fontSize:"22px", fontStyle:"italic", color:"var(--cream)" }}>{t.cart}</div>
              <button type="button" onClick={() => setCartOpen(false)} className="action-btn menu-cart-sheet-close">{t.cancel}</button>
            </div>
            <div style={{ overflowY:"auto", flex:1, padding:"12px 18px" }}>
              {cartLines.length === 0 ? (
                <div style={{ textAlign:"center", padding:"36px 12px", color:"var(--muted)", fontSize:"13px", fontFamily:"var(--font-display)", fontStyle:"italic" }}>{t.emptyCart}</div>
              ) : (
                cartLines.map(({ key, dish, qty, lineTotal, unitPrice, variantLabelText }) => (
                  <div key={key} style={{
                    display:"flex", gap:"12px", alignItems:"center", padding:"12px 0",
                    borderBottom:"1px solid rgba(255,255,255,0.05)",
                  }}>
                    <img
                      src={dish.image}
                      alt=""
                      width={52}
                      height={52}
                      loading="lazy"
                      decoding="async"
                      style={{ width:"52px", height:"52px", objectFit:"cover", borderRadius:"2px", flexShrink:0 }}
                    />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"var(--font-display)", fontSize:"15px", color:"var(--cream)", lineHeight:1.25 }}>{dish.name[lang]}</div>
                      {variantLabelText ? (
                        <div style={{ fontSize:"10px", color:"rgba(201,169,98,0.75)", marginTop:"3px" }}>{variantLabelText}</div>
                      ) : null}
                      <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"4px" }}>₾{formatLari(unitPrice)} × {qty}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} style={{ display:"flex", alignItems:"center", gap:"4px", flexShrink:0 }}>
                      <button type="button" className="menu-cart-sheet-qty-btn" aria-label={t.cartQty + " −"} onClick={() => bumpCartQty(key, -1)}>−</button>
                      <span style={{ minWidth:"22px", textAlign:"center", fontSize:"12px", color:"var(--gold-pale)", fontWeight:600 }}>{qty}</span>
                      <button
                        type="button"
                        className={`menu-cart-sheet-qty-btn menu-cart-sheet-qty-btn--plus`}
                        aria-label={t.cartQty + " +"}
                        onClick={() => dish.available && bumpCartQty(key, 1)}
                        disabled={!dish.available}
                      >+</button>
                    </div>
                    <div style={{ fontFamily:"var(--font-display)", fontSize:"17px", color:"var(--gold-light)", flexShrink:0, minWidth:"56px", textAlign:"right" }}>₾{formatLari(lineTotal)}</div>
                  </div>
                ))
              )}
            </div>
            {cartLines.length > 0 && (
              <div style={{ padding:"16px 18px 22px", borderTop:"1px solid rgba(61,191,176,0.12)", flexShrink:0, background:"rgba(7,6,8,0.5)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"10px" }}>
                  <span style={{ fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase", color:"var(--gold)" }}>{t.cartTotal}</span>
                  <span style={{ fontFamily:"var(--font-display)", fontSize:"32px", fontWeight:300, color:"var(--gold-light)" }}>₾{formatLari(cartGrandTotal)}</span>
                </div>
                <div style={{ fontSize:"10px", color:"var(--muted)", lineHeight:1.5, letterSpacing:"0.2px" }}>{t.cartHint}</div>
                <button
                  type="button"
                  onClick={() => setOrderConfirmOpen(true)}
                  className="action-btn"
                  style={{
                    marginTop:"16px",
                    width:"100%",
                    minHeight:"52px",
                    borderRadius:"999px",
                    border:"1px solid rgba(201,169,98,0.55)",
                    background:"linear-gradient(135deg, rgba(201,169,98,0.22), rgba(61,191,176,0.12))",
                    color:"#f4f1ea",
                    fontFamily:"var(--font-body)",
                    fontSize:"11px",
                    fontWeight:600,
                    letterSpacing:"0.14em",
                    textTransform:"uppercase",
                    cursor:"pointer",
                    touchAction:"manipulation",
                  }}
                >
                  {t.submitOrder}
                </button>
              </div>
            )}
          </div>

          {orderConfirmOpen && (
            <>
              <button
                type="button"
                aria-label={t.cancel}
                onClick={() => setOrderConfirmOpen(false)}
                style={{
                  position:"fixed",
                  inset:0,
                  zIndex:10145,
                  border:"none",
                  padding:0,
                  margin:0,
                  background:"rgba(0,0,0,0.78)",
                  cursor:"pointer",
                  WebkitTapHighlightColor:"transparent",
                }}
              />
              <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="order-confirm-title"
                style={{
                  position:"fixed",
                  left:"50%",
                  top:"50%",
                  transform:"translate(-50%, -50%)",
                  zIndex:10150,
                  width:"min(360px, calc(100vw - 32px))",
                  maxHeight:"min(420px, 80vh)",
                  overflow:"auto",
                  background:"var(--charcoal)",
                  border:"1px solid rgba(201,169,98,0.35)",
                  borderRadius:"16px",
                  padding:"22px 20px 18px",
                  boxShadow:"0 24px 80px rgba(0,0,0,0.75)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div id="order-confirm-title" style={{ fontFamily:"var(--font-display)", fontSize:"1.35rem", fontStyle:"italic", color:"var(--cream)", marginBottom:"10px" }}>
                  {t.confirmOrderTitle}
                </div>
                <p style={{ fontSize:"12px", color:"var(--muted)", lineHeight:1.55, marginBottom:"16px" }}>{t.confirmOrderBody}</p>
                <div style={{ fontSize:"11px", color:"rgba(201,169,98,0.9)", maxHeight:"140px", overflowY:"auto", padding:"10px 12px", background:"rgba(0,0,0,0.25)", borderRadius:"10px", whiteSpace:"pre-wrap", fontFamily:"var(--font-body)", lineHeight:1.45, marginBottom:"18px" }}>
                  {formatOrderNotificationBody(cartLines, lang, table.name, cartGrandTotal)}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                  <button
                    type="button"
                    onClick={() => setOrderConfirmOpen(false)}
                    className="action-btn"
                    style={{ minHeight:"48px", borderRadius:"999px", border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"var(--muted)", fontSize:"10px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={confirmSendOrder}
                    className="action-btn"
                    style={{ minHeight:"48px", borderRadius:"999px", border:"1px solid var(--gold)", background:"linear-gradient(135deg, rgba(61,191,176,0.25), rgba(61,191,176,0.08))", color:"var(--gold-pale)", fontSize:"10px", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}
                  >
                    {t.confirmOrderBtn}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* BOTTOM ACTIONS — full-width fixed strip; cart CTA stays above thumb reach */}
      <div className="menu-bottom-dock">
        <div className="menu-bottom-dock-inner">
          <div className="menu-cart-bar">
            {cartItemCount > 0 && (
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="action-btn menu-cart-open-btn"
                aria-label={`${t.cart}, ${cartItemCount}, ₾${formatLari(cartGrandTotal)}`}
              >
                <span style={{ fontSize:"9px", letterSpacing:"0.22em", textTransform:"uppercase", color:"rgba(244,241,234,0.9)" }}>{t.cart}</span>
                <span style={{ fontSize:"11px", color:"rgba(109,143,137,0.95)", letterSpacing:"0.08em" }}>{cartItemCount}</span>
                <span style={{ fontFamily:"var(--font-display)", fontSize:"clamp(1.15rem,4vw,1.4rem)", fontWeight:300, color:"#c9a962", marginLeft:"auto" }}>₾{formatLari(cartGrandTotal)}</span>
                <span style={{ fontSize:"11px", color:"rgba(201,169,98,0.55)" }} aria-hidden="true">▴</span>
              </button>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              <button type="button" onClick={callWaiter} className="action-btn menu-service-btn menu-service-btn--waiter">
                ✦ {t.callWaiter}
              </button>
              <button type="button" onClick={requestBill} className="action-btn menu-service-btn menu-service-btn--bill">
                ◇ {t.requestBill}
              </button>
            </div>
          </div>
        </div>
      </div>

      {variantModalDish && dishPriceVariants(variantModalDish).length > 0 && (
        <DishVariantModal
          dish={variantModalDish}
          lang={lang}
          t={t}
          onClose={() => setVariantModalDish(null)}
          onConfirm={(variantId) => {
            addToCart(variantModalDish, variantId);
            setVariantModalDish(null);
          }}
        />
      )}

      {/* TOAST */}
      {toast && (
        <div style={{
          position:"fixed", top:"100px", left:"50%",
          transform:"translateX(-50%)", zIndex:10140,
          background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.4)",
          color:"var(--gold-pale)", padding:"14px 28px",
          fontFamily:"var(--font-body)", fontSize:"12px", letterSpacing:"1.5px",
          boxShadow:"0 20px 60px rgba(0,0,0,0.8)", whiteSpace:"nowrap",
          animation:"toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CatBtn({ active, onClick, label, icon, tabKey }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`menu-cat-tab${active ? " menu-cat-tab--active" : ""}`}
      {...(tabKey != null ? { "data-cat-tab": String(tabKey) } : {})}
    >
      {icon && <span style={{ marginRight: "7px", opacity: active ? 1 : 0.65 }}>{icon}</span>}
      {label}
    </button>
  );
}

function dishBlurbText(dish, lang) {
  const d = dish?.description && typeof dish.description === "object" ? dish.description : {};
  const order = lang === "ka" ? ["ka", "en", "ru"] : lang === "ru" ? ["ru", "en", "ka"] : ["en", "ka", "ru"];
  for (const k of order) {
    const s = String(d[k] ?? "").trim();
    if (s) return s;
  }
  return "";
}

function DishRow({ dish, lang, t, expanded, onToggle, style, cartQty = 0, onAddToCart, onBumpCartQty, onOpenVariantModal }) {
  const [addPulse, setAddPulse] = useState(false);
  const addPulseTimerRef = useRef(null);
  const nameObj = dish.name && typeof dish.name === "object" ? dish.name : {};
  const title = String(nameObj[lang] || nameObj.en || nameObj.ka || "—").trim() || "—";
  const blurb = dishBlurbText(dish, lang);
  const badges = Array.isArray(dish.badges) ? dish.badges : [];
  const displayBadges = dish.featured ? badges.filter((b) => b !== "Chef's Table") : badges;
  const ingredients = Array.isArray(dish.ingredients) ? dish.ingredients : [];
  const hasVariants = dishPriceVariants(dish).length > 0;
  const mmPrice = minMaxVariantPrice(dish);

  const badgeLine = (b) => {
    if (b === "Chef's Table") return t.chefChoice;
    if (b === "Dry") return t.badgeDry;
    if (b === "Semi-Dry") return t.badgeSemiDry;
    if (b === "Semi-Sweet") return t.badgeSemiSweet;
    return b;
  };

  useEffect(() => {
    return () => {
      if (addPulseTimerRef.current) clearTimeout(addPulseTimerRef.current);
    };
  }, []);

  const triggerAddPulse = () => {
    if (addPulseTimerRef.current) clearTimeout(addPulseTimerRef.current);
    setAddPulse(true);
    addPulseTimerRef.current = setTimeout(() => {
      setAddPulse(false);
      addPulseTimerRef.current = null;
    }, 520);
  };

  return (
    <div
      className={`dish-card menu-dish-card${expanded ? " menu-dish-card--expanded" : ""}`}
      onClick={onToggle}
      style={{
        cursor: "pointer",
        opacity: dish.available ? 1 : 0.48,
        ...style,
      }}
    >
      <div className="dish-card-inner">
        <div className="dish-card-media">
          {dish.image ? (
            <img
              src={dish.image}
              alt={title}
              className="dish-img"
              loading="lazy"
              decoding="async"
              style={{
                filter: dish.available ? "none" : "grayscale(1)",
              }}
            />
          ) : (
            <div className="dish-img-placeholder">Image</div>
          )}
          {!dish.available && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(4,8,8,0.82)", pointerEvents:"none" }}>
              <span style={{ fontSize:"9px", letterSpacing:"0.2em", color:"rgba(238,246,244,0.75)", textTransform:"uppercase", fontFamily:"var(--font-body)", fontWeight:600 }}>{t.soldOut}</span>
            </div>
          )}
          {dish.featured && (
            <div style={{ position:"absolute", top:"10px", left:"10px", pointerEvents:"none" }}>
              <span className="menu-feature-pill" aria-label={t.chefChoice}>✦ {t.chefChoice}</span>
            </div>
          )}
        </div>

        <div className="menu-dish-card-body" style={{ flex:1, padding:"16px 18px", display:"flex", flexDirection:"column", justifyContent:"space-between", minWidth:0 }}>
          <div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"8px", alignItems:"center" }}>
              {displayBadges.map((b, bi) => (
                <span
                  key={`${dish.id}-b-${bi}-${b}`}
                  className="tag"
                  style={{
                    background: BADGE_CFG[b]?.bg || "#333",
                    color: BADGE_CFG[b]?.color || "#fff",
                    fontSize: "8px",
                    fontWeight: 700,
                    padding: "4px 10px",
                    borderRadius: "999px",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-body)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  }}
                >
                  {b === "Popular" && <span aria-hidden="true">🔥&nbsp;</span>}
                  {badgeLine(b)}
                </span>
              ))}
            </div>
            <div className="menu-dish-name">{title}</div>
            {blurb ? (
              <div
                className="menu-dish-blurb"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  whiteSpace: expanded ? "pre-wrap" : "normal",
                  ...(expanded
                    ? { overflow: "visible", maxHeight: "none", display: "block" }
                    : {
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        lineClamp: 3,
                        maxHeight: "4.8em",
                      }),
                }}
              >
                {blurb}
              </div>
            ) : null}
          </div>
          <div className="menu-dish-price-row" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginTop:"12px", gap:"10px" }}>
            <div className="menu-dish-price">
              {mmPrice ? `₾${formatLari(mmPrice.min)} – ₾${formatLari(mmPrice.max)}` : `₾${formatLari(dish.price)}`}
            </div>
            <div className="menu-dish-price-controls" style={{ display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
              <div
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                style={{ display:"flex", alignItems:"center", gap:"6px" }}
              >
                {hasVariants ? (
                  <>
                    {cartQty > 0 && (
                      <span
                        style={{
                          minWidth: "22px",
                          textAlign: "center",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "rgba(201,169,98,0.95)",
                          letterSpacing: "0.06em",
                        }}
                        aria-label={t.cartQty}
                      >
                        ×{cartQty}
                      </span>
                    )}
                    <button
                      type="button"
                      className={`menu-add-btn${addPulse ? " menu-add-btn--pulse" : ""}`}
                      disabled={!dish.available}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!dish.available) return;
                        onOpenVariantModal?.(dish);
                        triggerAddPulse();
                      }}
                    >
                      {cartQty > 0 ? t.addToCart : t.chooseOptions}
                    </button>
                  </>
                ) : (
                  <>
                    {cartQty > 0 && (
                      <>
                        <button type="button" className="menu-cart-step" aria-label={t.cartQty + " −"} onClick={() => onBumpCartQty(String(dish.id), -1)}>−</button>
                        <span style={{ minWidth:"20px", textAlign:"center", fontSize:"12px", fontWeight:600, color:"rgba(212,247,242,0.95)" }}>{cartQty}</span>
                        <button
                          type="button"
                          className={`menu-cart-step menu-cart-step--plus${addPulse ? " menu-cart-step--pulse" : ""}`}
                          aria-label={t.cartQty + " +"}
                          disabled={!dish.available}
                          onClick={() => {
                            if (!dish.available) return;
                            onBumpCartQty(String(dish.id), 1);
                            triggerAddPulse();
                          }}
                          style={{ opacity: dish.available ? 1 : 0.35, cursor: dish.available ? "pointer" : "not-allowed" }}
                        >
                          +
                        </button>
                      </>
                    )}
                    {cartQty === 0 && (
                      <button
                        type="button"
                        className={`menu-add-btn${addPulse ? " menu-add-btn--pulse" : ""}`}
                        disabled={!dish.available}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!dish.available) return;
                          onAddToCart(dish, null);
                          triggerAddPulse();
                        }}
                      >
                        {t.addToCart}
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="menu-expand-chevron" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} aria-hidden="true">▾</div>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="menu-dish-expanded" onClick={(e) => e.stopPropagation()}>
          <div style={{ fontSize:"8px", color:"#c9a962", letterSpacing:"0.28em", textTransform:"uppercase", marginBottom:"12px", fontFamily:"var(--font-body)", fontWeight:600 }}>
            ✦ {t.ingredients}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
            {ingredients.map((ing, ii) => (
              <span
                key={`${dish.id}-ing-${ii}-${ing}`}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: "1px solid rgba(61,191,176,0.22)",
                  fontSize: "10px",
                  color: "rgba(212,247,242,0.9)",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  background: "rgba(6,12,12,0.45)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {ing}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN LOGIN
═══════════════════════════════════════════════════════════════════════════ */
function AdminLogin({ onLogin }) {
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(false);
  const submit = () => { if (u==="admin"&&p==="tiflisi2024") onLogin(); else setErr(true); };

  return (
    <div style={{ minHeight:"100vh", background:"var(--obsidian)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-body)", position:"relative" }}>
      <div className="noise" />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 70%, rgba(196,88,68,0.07) 0%, transparent 50%), radial-gradient(ellipse at 50% 30%, rgba(61,191,176,0.08) 0%, transparent 60%)" }} />

      <div style={{ width:"380px", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:"48px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"5px", color:"var(--gold)", textTransform:"uppercase", marginBottom:"14px" }}>STAFF ACCESS</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"52px", fontWeight:300, fontStyle:"italic", color:"var(--cream)", lineHeight:1 }}>Tiflisi</div>
          <div style={{ marginTop:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, transparent, var(--gold))" }} />
            <span style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"3px" }}>ADMIN PANEL</span>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, var(--gold), transparent)" }} />
          </div>
        </div>

        <div style={{ background:"rgba(26,22,32,0.8)", border:"1px solid rgba(61,191,176,0.15)", padding:"40px", backdropFilter:"blur(20px)" }}>
          {[{label:"Username",val:u,set:setU,type:"text"},{label:"Password",val:p,set:setP,type:"password"}].map(f => (
            <div key={f.label} style={{ marginBottom:"20px" }}>
              <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"8px" }}>{f.label}</div>
              <input value={f.val} onChange={e=>{f.set(e.target.value);setErr(false);}} type={f.type}
                onKeyDown={e=>e.key==="Enter"&&submit()}
                style={{ width:"100%", padding:"12px 0", background:"transparent", border:"none", borderBottom:`1px solid ${err?"#ef4444":"rgba(61,191,176,0.25)"}`, color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", letterSpacing:"1px", boxSizing:"border-box" }} />
            </div>
          ))}
          {err && <div style={{ color:"#ef4444", fontSize:"10px", letterSpacing:"1px", marginBottom:"16px" }}>INVALID CREDENTIALS</div>}
          <div style={{ fontSize:"9px", color:"var(--muted)", marginBottom:"20px", letterSpacing:"1px" }}>admin / tiflisi2024</div>
          <button onClick={submit} style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg, rgba(61,191,176,0.2), rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"10px", fontWeight:"600", letterSpacing:"4px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)", transition:"all 0.3s" }}>
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}

/* მიმტანის შესვლა — ცალკე პაროლი ადმინისგან (იხ. ქვედა hint). */
function StaffLogin({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (u === "waiter" && p === "tiflisi2024") onLogin();
    else setErr(true);
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--obsidian)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"var(--font-body)", position:"relative" }}>
      <div className="noise" />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 70%, rgba(196,88,68,0.07) 0%, transparent 50%), radial-gradient(ellipse at 50% 30%, rgba(61,191,176,0.08) 0%, transparent 60%)" }} />

      <div style={{ width:"min(380px, 92vw)", position:"relative", zIndex:1 }}>
        <div style={{ textAlign:"center", marginBottom:"48px" }}>
          <div style={{ fontSize:"9px", letterSpacing:"5px", color:"var(--gold)", textTransform:"uppercase", marginBottom:"14px" }}>მიმტანი · WAITER</div>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"52px", fontWeight:300, fontStyle:"italic", color:"var(--cream)", lineHeight:1 }}>Tiflisi</div>
          <div style={{ marginTop:"16px", display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, transparent, var(--gold))" }} />
            <span style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"3px" }}>გამოძახება · ანგარიში · ALERT</span>
            <div style={{ width:"40px", height:"1px", background:"linear-gradient(90deg, var(--gold), transparent)" }} />
          </div>
        </div>

        <div style={{ background:"rgba(26,22,32,0.8)", border:"1px solid rgba(61,191,176,0.15)", padding:"40px", backdropFilter:"blur(20px)" }}>
          {[{ label:"Username", val: u, set: setU, type: "text" }, { label:"Password", val: p, set: setP, type: "password" }].map((f) => (
            <div key={f.label} style={{ marginBottom:"20px" }}>
              <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"8px" }}>{f.label}</div>
              <input
                value={f.val}
                onChange={(e) => {
                  f.set(e.target.value);
                  setErr(false);
                }}
                type={f.type}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                style={{ width:"100%", padding:"12px 0", background:"transparent", border:"none", borderBottom:`1px solid ${err ? "#ef4444" : "rgba(61,191,176,0.25)"}`, color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", letterSpacing:"1px", boxSizing:"border-box" }}
              />
            </div>
          ))}
          {err && <div style={{ color:"#ef4444", fontSize:"10px", letterSpacing:"1px", marginBottom:"16px" }}>არასწორი მონაცემი</div>}
          <div style={{ fontSize:"9px", color:"var(--muted)", marginBottom:"20px", letterSpacing:"1px" }}>waiter / tiflisi2024</div>
          <button
            type="button"
            onClick={submit}
            style={{ width:"100%", padding:"14px", background:"linear-gradient(135deg, rgba(61,191,176,0.2), rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"10px", fontWeight:"600", letterSpacing:"4px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)", transition:"all 0.3s" }}
          >
            შესვლა
          </button>
        </div>
      </div>
    </div>
  );
}

/** Supabase: upload image to Storage, insert row into public.menu (see supabase/schema.sql). */
function AdminCloudMenu({ store }) {
  const { categories, dishes, reloadMenuFromSupabase, menuLoading } = store;
  const sortedCats = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);
  const [categoryId, setCategoryId] = useState(() => sortedCats[0]?.id ?? "");
  const [existingDishId, setExistingDishId] = useState("");

  const dishOptions = useMemo(() => {
    const catOrder = new Map(sortedCats.map((c, i) => [c.id, i]));
    return [...dishes].sort((a, b) => {
      const oa = catOrder.get(a.categoryId) ?? 999;
      const ob = catOrder.get(b.categoryId) ?? 999;
      if (oa !== ob) return oa - ob;
      const ord = (a.order ?? 0) - (b.order ?? 0);
      if (ord !== 0) return ord;
      const ta = a.name?.en || a.name?.ka || "";
      const tb = b.name?.en || b.name?.ka || "";
      return ta.localeCompare(tb, "ka");
    });
  }, [dishes, sortedCats]);

  const selectedDish = useMemo(
    () => (existingDishId ? dishes.find((d) => String(d.id) === String(existingDishId)) : null),
    [dishes, existingDishId]
  );

  useEffect(() => {
    const first = sortedCats[0]?.id;
    if (first == null) {
      setCategoryId("");
      return;
    }
    if (existingDishId && selectedDish) {
      setCategoryId(selectedDish.categoryId);
      return;
    }
    setCategoryId((prev) => (sortedCats.some((c) => c.id === prev) ? prev : first));
  }, [sortedCats, existingDishId, selectedDish]);

  const [name, setName] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionKa, setDescriptionKa] = useState("");
  const [descriptionRu, setDescriptionRu] = useState("");
  const [price, setPrice] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const dishOptionLabel = (d) => {
    const cat = sortedCats.find((c) => c.id === d.categoryId);
    const catEn = cat?.name?.en || cat?.name?.ka || "—";
    const title = d.name?.en || d.name?.ka || "—";
    return `${catEn} · ${title} · ${formatLari(d.price)} ₾`;
  };

  const inputStyle = { width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"13px", fontFamily:"var(--font-body)", borderRadius:"2px", boxSizing:"border-box" };
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"8px", display:"block" };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!isSupabaseConfigured()) {
      setErr("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.");
      return;
    }
    if (!sortedCats.length) {
      setErr("ჯგუფები ცარიელია — Admin → Cuisine → Categories-დან დაამატე კატეგორია.");
      return;
    }
    if (!file) {
      setErr("აირჩიე სურათის ფაილი.");
      return;
    }
    if (existingDishId) {
      if (!dishes.some((d) => String(d.id) === String(existingDishId))) {
        setErr("არასწორი კერძი.");
        return;
      }
    } else {
      if (categoryId === "" || categoryId == null) {
        setErr("აირჩიე კატეგორია.");
        return;
      }
      if (!name.trim()) {
        setErr("Name is required.");
        return;
      }
      const priceNum = parsePriceValue(price);
      if (!Number.isFinite(priceNum) || priceNum < 0) {
        setErr("Enter a valid price.");
        return;
      }
    }
    setBusy(true);
    try {
      const imageUrl = await uploadMenuImage(file);
      if (existingDishId) {
        await updateMenuDishImageUrl(existingDishId, imageUrl);
        setMsg("სურათი მიება კერძს Supabase-ში. მენიუ განახლდა.");
        setFile(null);
        await reloadMenuFromSupabase();
        return;
      }
      const priceNum = parsePriceValue(price);
      const catDishes = dishes.filter((d) => d.categoryId === Number(categoryId));
      const maxOrder = catDishes.reduce((m, d) => Math.max(m, d.order ?? 0), 0);
      await insertMenuItem({
        categoryId: Number(categoryId),
        name: name.trim(),
        description: {
          en: descriptionEn.trim(),
          ka: descriptionKa.trim(),
          ru: descriptionRu.trim(),
        },
        price: priceNum,
        imageUrl,
        sortOrder: maxOrder + 1,
      });
      setMsg("Saved to Supabase. Menu refreshed.");
      setName("");
      setDescriptionEn("");
      setDescriptionKa("");
      setDescriptionRu("");
      setPrice("");
      setFile(null);
      await reloadMenuFromSupabase();
    } catch (x) {
      setErr(x?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div style={{ padding:"40px", color:"var(--cream)", maxWidth:"720px" }}>
        <PageHeader title="Cloud menu" sub="Supabase" />
        <p style={{ fontSize:"13px", color:"var(--muted)", lineHeight:1.7, marginBottom:"20px" }}>
          Copy <code style={{ color:"var(--gold)" }}>.env.example</code> to <code style={{ color:"var(--gold)" }}>.env.local</code> and set{" "}
          <code style={{ color:"var(--gold)" }}>VITE_SUPABASE_URL</code> and <code style={{ color:"var(--gold)" }}>VITE_SUPABASE_ANON_KEY</code>.
          Run the SQL in <code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>, create bucket <strong style={{ color:"var(--cream)" }}>menu-images</strong> (public), then restart <code style={{ color:"var(--gold)" }}>npm run dev</code>.
        </p>
      </div>
    );
  }

  const updateMode = Boolean(existingDishId);

  return (
    <div style={{ padding:"40px", color:"var(--cream)", maxWidth:"560px" }}>
      <PageHeader
        title="Cloud menu"
        sub={updateMode ? "არსებული კერძი → სურათი → Storage · განახლება Postgres-ში" : "ახალი კერძი · სურათი → Storage · ჩანაწერი Postgres-ში"}
      />
      {err && <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"12px" }}>{err}</div>}
      {msg && <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(16,185,129,0.35)", background:"rgba(16,185,129,0.08)", color:"#86efac", fontSize:"12px" }}>{msg}</div>}
      <form onSubmit={onSubmit} style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
        <div>
          <label style={labelStyle}>არსებული კერძი (სურათის მისაბმელად)</label>
          <select
            value={existingDishId}
            onChange={(e) => {
              const v = e.target.value;
              setExistingDishId(v);
              setErr("");
              setMsg("");
              setFile(null);
              if (v) {
                setName("");
                setDescriptionEn("");
                setDescriptionKa("");
                setDescriptionRu("");
                setPrice("");
              }
            }}
            disabled={menuLoading}
            style={{ ...inputStyle, cursor: menuLoading ? "wait" : "pointer", opacity: menuLoading ? 0.7 : 1 }}
          >
            <option value="" style={{ background:"#132220" }}>
              — ახალი კერძი (ქვემოთ შეავსე სახელი, ფასი) —
            </option>
            {dishOptions.map((d) => (
              <option key={d.id} value={String(d.id)} style={{ background:"#132220" }}>
                {dishOptionLabel(d)}
              </option>
            ))}
          </select>
          {menuLoading && (
            <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>მენიუ იტვირთება…</div>
          )}
          {!menuLoading && dishes.length === 0 && (
            <div style={{ marginTop:"8px", fontSize:"11px", color:"var(--muted)" }}>კერძები ჯერ არ ჩანს — შეამოწმე Supabase ან SQL seed.</div>
          )}
        </div>

        {selectedDish && (
          <div
            style={{
              padding:"14px",
              border:"1px solid rgba(61,191,176,0.2)",
              background:"rgba(61,191,176,0.06)",
              borderRadius:"2px",
              display:"flex",
              gap:"14px",
              alignItems:"flex-start",
            }}
          >
            {selectedDish.image ? (
              <img
                src={selectedDish.image}
                alt=""
                width={72}
                height={72}
                loading="lazy"
                decoding="async"
                style={{ width:"72px", height:"72px", objectFit:"cover", borderRadius:"2px", flexShrink:0, border:"1px solid rgba(255,255,255,0.08)" }}
              />
            ) : (
              <div
                style={{
                  width:"72px",
                  height:"72px",
                  flexShrink:0,
                  borderRadius:"2px",
                  border:"1px dashed rgba(255,255,255,0.15)",
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  fontSize:"9px",
                  color:"var(--muted)",
                  textAlign:"center",
                  padding:"4px",
                  lineHeight:1.3,
                }}
              >
                სურათი არაა
              </div>
            )}
            <div style={{ minWidth:0, fontSize:"12px", lineHeight:1.5 }}>
              <div style={{ color:"var(--gold)", fontSize:"8px", letterSpacing:"2px", textTransform:"uppercase", marginBottom:"6px" }}>არჩეული</div>
              <div style={{ fontFamily:"var(--font-display)", color:"var(--cream)" }}>{selectedDish.name?.en || selectedDish.name?.ka || "—"}</div>
              {(selectedDish.name?.ka || selectedDish.name?.ru) && (
                <div style={{ color:"var(--muted)", marginTop:"4px", fontSize:"11px" }}>
                  {[selectedDish.name?.ka, selectedDish.name?.ru].filter(Boolean).join(" · ")}
                </div>
              )}
              <div style={{ marginTop:"8px", color:"var(--muted)" }}>{formatLari(selectedDish.price)} ₾</div>
            </div>
          </div>
        )}

        <div>
          <label style={labelStyle}>Category</label>
          <select
            value={categoryId === "" || categoryId == null ? "" : String(categoryId)}
            onChange={(e) => {
              const v = e.target.value;
              setCategoryId(v === "" ? "" : Number(v));
            }}
            disabled={updateMode}
            style={{ ...inputStyle, cursor: updateMode ? "not-allowed" : "pointer", opacity: updateMode ? 0.65 : 1 }}
          >
            {sortedCats.length === 0 ? (
              <option value="" style={{ background:"#132220" }}>— ჯგუფი არაა —</option>
            ) : (
              sortedCats.map((c) => (
                <option key={c.id} value={c.id} style={{ background:"#132220" }}>{c.name.en || c.name.ka || `Category ${c.id}`}</option>
              ))
            )}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, opacity: updateMode ? 0.5 : 1 }}
            placeholder="Dish name (English)"
            readOnly={updateMode}
            disabled={updateMode}
          />
        </div>
        {[
          { key: "en", label: "Description (EN)", val: descriptionEn, set: setDescriptionEn, ph: "Short description (English)" },
          { key: "ka", label: "აღწერა (KA)", val: descriptionKa, set: setDescriptionKa, ph: "მოკლე აღწერა ქართულად" },
          { key: "ru", label: "Описание (RU)", val: descriptionRu, set: setDescriptionRu, ph: "Краткое описание по-русски" },
        ].map((f) => (
          <div key={f.key}>
            <label style={labelStyle}>{f.label}</label>
            <textarea
              value={f.val}
              onChange={(e) => f.set(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-display)", opacity: updateMode ? 0.5 : 1 }}
              placeholder={f.ph}
              readOnly={updateMode}
              disabled={updateMode}
            />
          </div>
        ))}
        <div>
          <label style={labelStyle}>Price (₾)</label>
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...inputStyle, opacity: updateMode ? 0.5 : 1 }}
            readOnly={updateMode}
            disabled={updateMode}
          />
        </div>
        <div>
          <label style={labelStyle}>Image file</label>
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ fontSize:"12px", color:"var(--muted)" }} />
        </div>
        <button type="submit" disabled={busy || menuLoading} style={{ padding:"14px", background: busy ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"10px", letterSpacing:"3px", textTransform:"uppercase", cursor: busy ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>
          {busy ? "Uploading…" : updateMode ? "განაახლე სურათი Supabase-ში" : "Save to Supabase"}
        </button>
      </form>
    </div>
  );
}

/** `public/alert.mp3` — ჩაანაცვლე საკუთარი ფაილით; სიძლიერე: `volume` ან ფაილის ნორმალიზაცია. */
const ALERT_MP3_VOLUME = 1;

function alertMp3Url() {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.endsWith("/") ? base : `${base}/`}alert.mp3`;
}

/** თუ MP3 ვერ იკითხება / play() ჩავარდა — ძველი სინთეზირებული ზარი. */
function playAlertSynthFallback() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const masterPeak = 0.28;
    const masterSustain = 0.18;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(masterPeak, now + 0.06);
    master.gain.exponentialRampToValueAtTime(masterSustain, now + 3.65);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 4.02);
    master.connect(ctx.destination);

    const playTone = (start, freq, type = "sine", duration = 0.42, gainPeak = 0.85) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(master);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    const pulses = [0, 0.98, 1.96, 2.94];
    for (const t of pulses) {
      playTone(now + t, 988, "triangle", 0.34, 0.88);
      playTone(now + t + 0.11, 1318, "sine", 0.34, 0.72);
    }
    window.setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 4500);
  } catch {
    /* ignore */
  }
}

/** სტუმრის ახალი შეტყობინებისას — `public/alert.mp3` (HTMLAudioElement), რეზერვი: სინთეზატორი. */
function useUnreadAlertSound(unread) {
  const mp3Ref = useRef(null);
  const prevUnreadRef = useRef(unread);
  const mountedRef = useRef(false);

  const playAlertChime = useCallback(() => {
    try {
      const url = alertMp3Url();
      let a = mp3Ref.current;
      if (!a) {
        a = new Audio(url);
        a.preload = "auto";
        mp3Ref.current = a;
      }
      a.volume = Math.min(1, Math.max(0, ALERT_MP3_VOLUME));
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => playAlertSynthFallback());
      }
    } catch {
      playAlertSynthFallback();
    }
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevUnreadRef.current = unread;
      return;
    }
    if (unread > prevUnreadRef.current) {
      playAlertChime();
    }
    prevUnreadRef.current = unread;
  }, [unread, playAlertChime]);

  useEffect(() => {
    return () => {
      try {
        const a = mp3Ref.current;
        if (a) {
          a.pause();
          a.src = "";
        }
        mp3Ref.current = null;
      } catch {}
    };
  }, []);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN PANEL
═══════════════════════════════════════════════════════════════════════════ */
function AdminPanel({ store, onLogout }) {
  const [section, setSection] = useState("dashboard");
  const unread = store.notifications.filter(n=>!n.read).length;
  useUnreadAlertSound(unread);

  const navItems = [
    { id:"dashboard", icon:"◈", label:"Overview" },
    { id:"menu",      icon:"◇", label:"Cuisine" },
    { id:"cloud",     icon:"☁", label:"Cloud" },
    { id:"tables",    icon:"◉", label:"Seating" },
    { id:"alerts",    icon:"◌", label:"Alerts", badge:unread },
    { id:"analytics", icon:"◎", label:"Insights" },
  ];

  return (
    <div className="admin-panel-layout">
      <div className="noise" />

      {/* SIDEBAR */}
      <div className="admin-panel-sidebar" style={{ width:"210px", background:"var(--charcoal)", borderRight:"1px solid rgba(61,191,176,0.1)", display:"flex", flexDirection:"column", flexShrink:0, position:"relative", zIndex:10 }}>
        <div style={{ padding:"28px 20px 24px", borderBottom:"1px solid rgba(61,191,176,0.1)" }}>
          <div style={{ fontFamily:"var(--font-display)", fontSize:"26px", fontStyle:"italic", fontWeight:300, color:"var(--cream)" }}>Tiflisi</div>
          <div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"3px", textTransform:"uppercase", marginTop:"4px" }}>Admin Console</div>
        </div>

        <nav style={{ flex:1, padding:"16px 12px" }}>
          {navItems.map(item => (
            <button type="button" key={item.id} onClick={() => setSection(item.id)} className="admin-nav-item" style={{
              width:"100%", display:"flex", alignItems:"center", gap:"10px",
              padding:"11px 12px", border:"none",
              background: section===item.id ? "rgba(61,191,176,0.1)" : "transparent",
              color: section===item.id ? "var(--gold)" : "var(--muted)",
              fontSize:"10px", fontWeight:section===item.id?"600":"400",
              cursor:"pointer", marginBottom:"2px", textAlign:"left",
              letterSpacing:"2px", textTransform:"uppercase", position:"relative",
              borderLeft: section===item.id ? "1px solid var(--gold)" : "1px solid transparent",
              transition:"all 0.2s",
            }}>
              <span style={{ fontSize:"14px" }}>{item.icon}</span> {item.label}
              {item.badge>0 && (
                <span style={{ marginLeft:"auto", background:"#7f1d1d", color:"#fca5a5", fontSize:"9px", fontWeight:"700", padding:"1px 6px", minWidth:"16px", textAlign:"center" }}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ padding:"16px 12px", borderTop:"1px solid rgba(61,191,176,0.1)" }}>
          <button type="button" onClick={onLogout} style={{ width:"100%", padding:"10px 12px", background:"transparent", border:"1px solid rgba(239,68,68,0.2)", color:"rgba(239,68,68,0.6)", fontSize:"9px", letterSpacing:"2px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)", transition:"all 0.2s", touchAction:"manipulation", WebkitTapHighlightColor:"transparent" }}>
            EXIT SESSION
          </button>
          {import.meta.env.VITE_DEPLOY_STAMP ? (
            <div style={{ marginTop:"10px", fontSize:"7px", lineHeight:1.35, color:"var(--muted)", letterSpacing:"0.3px", wordBreak:"break-all", opacity:0.75 }} title="GitHub Actions build id — თუ ეს ტექსტი არ ჩანს, ძველი bundle იტვირთება (cache).">
              build {String(import.meta.env.VITE_DEPLOY_STAMP)}
            </div>
          ) : null}
        </div>
      </div>

      {/* CONTENT */}
      <div className="admin-panel-main" style={{ flex:1, minWidth:0, overflow:"auto", WebkitOverflowScrolling:"touch", position:"relative", zIndex:1 }}>
        {section==="dashboard"  && <AdminDash store={store} />}
        {section==="menu"       && <AdminMenu store={store} />}
        {section==="cloud"      && <AdminCloudMenu store={store} />}
        {section==="tables"     && <AdminTables store={store} />}
        {section==="alerts"     && <AdminAlerts store={store} />}
        {section==="analytics"  && <AdminAnalytics store={store} />}
      </div>
    </div>
  );
}

/* ─── Shared Admin Components ─────────────────────────────────────────── */
function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"32px" }}>
      <div>
        <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"6px" }}>{sub}</div>
        <h1 style={{ fontFamily:"var(--font-display)", fontSize:"36px", fontWeight:300, fontStyle:"italic", color:"var(--cream)", margin:0, letterSpacing:"-0.5px" }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}

function Stat({ icon, label, value, trend, color="var(--gold)" }) {
  return (
    <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px 20px", position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, right:0, width:"60px", height:"60px", background:`radial-gradient(circle at 80% 20%, ${color}15, transparent 70%)` }} />
      <div style={{ fontSize:"22px", marginBottom:"12px" }}>{icon}</div>
      <div style={{ fontFamily:"var(--font-display)", fontSize:"36px", fontWeight:300, color, letterSpacing:"-1px" }}>{value}</div>
      <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"2px", textTransform:"uppercase", marginTop:"4px" }}>{label}</div>
      {trend && <div style={{ fontSize:"9px", color:"#10b981", marginTop:"6px" }}>{trend}</div>}
    </div>
  );
}

/* ─── Dashboard ───────────────────────────────────────────────────────── */
function AdminDash({ store }) {
  const active = store.tables.filter(t=>t.active).length;
  const topDish = store.dishes.reduce((a,b) => (store.analytics.views[a.id]||0) > (store.analytics.views[b.id]||0) ? a : b, store.dishes[0]);
  const totalViews = Object.values(store.analytics.views).reduce((a,b)=>a+b,0);

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Overview" sub="Tiflisi · Live Dashboard" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"12px", marginBottom:"32px" }}>
        <Stat icon="◈" label="Scans Today" value={store.analytics.scans} color="var(--gold)" />
        <Stat icon="◉" label="Active Tables" value={active} color="#10b981" />
        <Stat icon="◎" label="Dish Views" value={totalViews} color="#8b5cf6" />
        <Stat icon="◇" label="Total Dishes" value={store.dishes.length} color="var(--amber)" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        {/* Recent Alerts */}
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Recent Alerts</div>
          {store.notifications.slice(0,5).map(n => {
            const vis = notificationVisual(n.type);
            const msgOneLine =
              n.type === "order" && n.message
                ? (() => {
                    const lines = String(n.message).split("\n").map((s) => s.trim()).filter(Boolean);
                    if (lines.length <= 1) return lines[0] || n.message;
                    return `${lines[0]} · ${lines[1]}…`;
                  })()
                : n.message;
            return (
            <div key={n.id} style={{ display:"flex", gap:"12px", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ width:"28px", height:"28px", background: vis.sheetBg, border:`1px solid ${vis.sheetBd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", flexShrink:0, color: vis.accent }}>
                {vis.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"12px", color:"var(--cream)", fontWeight:500 }}>{n.tableName}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", marginTop:"2px", letterSpacing:"0.5px", whiteSpace: n.type==="order" ? "normal" : "nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{msgOneLine} · {n.time?.toLocaleTimeString()}</div>
              </div>
            </div>
            );
          })}
          {store.notifications.length===0 && <div style={{ fontSize:"11px", color:"var(--subtle)", fontStyle:"italic", fontFamily:"var(--font-display)" }}>No alerts at this time</div>}
        </div>

        {/* Tables */}
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"24px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Seating Status</div>
          {store.tables.map(tb => (
            <div key={tb.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 12px", marginBottom:"6px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.04)" }}>
              <div>
                <div style={{ fontSize:"12px", color:"var(--cream)" }}>{tb.name}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"1px" }}>{tb.zone}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"6px", height:"6px", borderRadius:"50%", background: tb.active?"#10b981":"var(--subtle)", animation: tb.active?"pulse 2s infinite":"none" }} />
                <span style={{ fontSize:"9px", color: tb.active?"#10b981":"var(--subtle)", letterSpacing:"1px" }}>{tb.active?"ACTIVE":"OFFLINE"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Menu Management ─────────────────────────────────────────────────── */
function AdminMenu({ store }) {
  const { categories, setCategories, dishes, setDishes, menuError, clearMenuError } = store;
  const syncDishesToSupabase = isSupabaseConfigured();
  const [adminTab, setAdminTab] = useState("dishes");
  const [filter, setFilter] = useState(null);
  const [modal, setModal] = useState(null);
  const [dishCloudErr, setDishCloudErr] = useState(null);
  const [dishSaving, setDishSaving] = useState(false);
  const [catModal, setCatModal] = useState(null);
  const [catForm, setCatForm] = useState(null);
  const [categoryError, setCategoryError] = useState(null);
  const [catSaving, setCatSaving] = useState(false);

  const sortedCats = useMemo(() => [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [categories]);

  const emptyDish = useCallback(() => ({
    id: null,
    categoryId: sortedCats[0]?.id,
    name: { en: "", ka: "", ru: "" },
    description: { en: "", ka: "", ru: "" },
    price: "",
    image: "",
    ingredients: [],
    badges: [],
    priceVariants: [],
    available: true,
    featured: false,
  }), [sortedCats]);

  const [form, setForm] = useState(() => ({
    id: null,
    categoryId: undefined,
    name: { en: "", ka: "", ru: "" },
    description: { en: "", ka: "", ru: "" },
    price: "",
    image: "",
    ingredients: [],
    badges: [],
    priceVariants: [],
    available: true,
    featured: false,
  }));

  const emptyCategory = useCallback(() => {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.order ?? 0), 0);
    return { id: null, name: { en: "", ka: "", ru: "" }, icon: "◆", order: maxOrder + 1 };
  }, [categories]);

  const openNew = () => { setDishCloudErr(null); setForm(emptyDish()); setModal("new"); };
  const openEdit = (d) => {
    setDishCloudErr(null);
    const pv = Array.isArray(d.priceVariants)
      ? d.priceVariants.map((v) => ({
          id: String(v?.id ?? ""),
          price: v?.price ?? "",
          label: {
            en: String(v?.label?.en ?? ""),
            ka: String(v?.label?.ka ?? ""),
            ru: String(v?.label?.ru ?? ""),
          },
        }))
      : [];
    setForm({
      ...d,
      ingredients: [...(d.ingredients || [])],
      badges: [...(d.badges || [])],
      priceVariants: pv,
    });
    setModal(d.id);
  };

  const save = async () => {
    setDishCloudErr(null);
    if (!sortedCats.length) {
      setDishCloudErr("ჯგუფი არ გაქვს — ჯერ დაამატე კატეგორია (Categories).");
      return;
    }
    if (!Number.isFinite(Number(form.categoryId))) {
      setDishCloudErr("აირჩიე კატეგორია.");
      return;
    }
    const priceNum = parsePriceValue(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setDishCloudErr("Enter a valid price.");
      return;
    }
    const priceVariantsClean = normalizePriceVariantsFromRow(form.priceVariants);
    let payload = { ...form, price: priceNum, categoryId: Number(form.categoryId), priceVariants: priceVariantsClean };
    if (modal === "new") {
      const maxOrder = dishes.filter((d) => d.categoryId === payload.categoryId).reduce((m, d) => Math.max(m, d.order ?? 0), 0);
      payload = { ...payload, order: maxOrder + 1 };
    } else {
      const prev = dishes.find((d) => String(d.id) === String(modal));
      if (prev && prev.categoryId !== payload.categoryId) {
        const maxOrder = dishes
          .filter((d) => d.categoryId === payload.categoryId && String(d.id) !== String(modal))
          .reduce((m, d) => Math.max(m, d.order ?? 0), 0);
        payload = { ...payload, order: maxOrder + 1 };
      }
    }

    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        if (modal === "new") {
          const created = await insertFullMenuDish(payload);
          setDishes((p) => [...p, created]);
          setFilter(null);
        } else {
          const updated = await updateFullMenuDish(modal, payload);
          setDishes((p) => p.map((d) => (String(d.id) === String(modal) ? updated : d)));
        }
        clearMenuError();
        setModal(null);
      } catch (e) {
        setDishCloudErr(e?.message || "Could not save to Supabase");
      } finally {
        setDishSaving(false);
      }
      return;
    }

    if (modal === "new") {
      setDishes((p) => [...p, { ...payload, id: Date.now() }]);
      setFilter(null);
    } else {
      setDishes((p) => p.map((d) => (String(d.id) === String(modal) ? { ...payload, id: modal } : d)));
    }
    setModal(null);
  };

  const del = async (id) => {
    setDishCloudErr(null);
    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        await deleteMenuDishById(id);
        setDishes((p) => p.filter((d) => String(d.id) !== String(id)));
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not delete");
      } finally {
        setDishSaving(false);
      }
      return;
    }
    setDishes((p) => p.filter((d) => String(d.id) !== String(id)));
  };

  const toggle = async (id) => {
    setDishCloudErr(null);
    const row = dishes.find((d) => String(d.id) === String(id));
    if (!row) return;
    if (syncDishesToSupabase) {
      setDishSaving(true);
      try {
        await setMenuDishAvailable(id, !row.available);
        setDishes((p) => p.map((d) => (String(d.id) === String(id) ? { ...d, available: !d.available } : d)));
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not update availability");
      } finally {
        setDishSaving(false);
      }
      return;
    }
    setDishes((p) => p.map((d) => (String(d.id) === String(id) ? { ...d, available: !d.available } : d)));
  };

  const openNewCategory = () => { setCategoryError(null); setCatForm(emptyCategory()); setCatModal("new"); };
  const openEditCategory = c => { setCategoryError(null); setCatForm({ ...c, name: { ...c.name } }); setCatModal(c.id); };
  const saveCategory = async () => {
    setCategoryError(null);
    const hasName = [catForm.name.en, catForm.name.ka, catForm.name.ru].some(s => String(s || "").trim());
    if (!hasName) { setCategoryError("Add at least one name (EN, KA, or RU)."); return; }
    const orderNum = Number(catForm.order);
    const payload = { ...catForm, order: Number.isFinite(orderNum) ? orderNum : 0 };

    if (syncDishesToSupabase) {
      setCatSaving(true);
      try {
        if (catModal === "new") {
          const nid = categories.length ? Math.max(...categories.map((c) => c.id)) + 1 : 1;
          const created = await insertMenuCategory({ ...payload, id: nid });
          setCategories((p) => [...p, created]);
        } else {
          const updated = await updateMenuCategory(catModal, { ...payload, id: catModal });
          setCategories((p) => p.map((c) => (c.id === catModal ? updated : c)));
        }
        clearMenuError();
        setCatModal(null);
        setCatForm(null);
      } catch (e) {
        setCategoryError(e?.message || "Could not save category to Supabase");
      } finally {
        setCatSaving(false);
      }
      return;
    }

    if (catModal === "new") {
      const nid = categories.length ? Math.max(...categories.map(c => c.id)) + 1 : 1;
      setCategories(p => [...p, { ...payload, id: nid }]);
    } else {
      setCategories(p => p.map(c => c.id === catModal ? { ...payload, id: catModal } : c));
    }
    setCatModal(null);
    setCatForm(null);
  };
  const delCategory = async (id) => {
    setCategoryError(null);
    if (dishes.some((d) => sameCategoryId(d.categoryId, id))) {
      setCategoryError("Reassign or remove dishes in this category before deleting.");
      return;
    }
    if (syncDishesToSupabase) {
      setCatSaving(true);
      try {
        await deleteMenuCategory(id);
        setCategories((p) => p.filter((c) => c.id !== id));
        if (filter != null && sameCategoryId(filter, id)) setFilter(null);
        clearMenuError();
      } catch (e) {
        setCategoryError(e?.message || "Could not delete category");
      } finally {
        setCatSaving(false);
      }
      return;
    }
    setCategories(p => p.filter(c => c.id !== id));
    if (filter != null && sameCategoryId(filter, id)) setFilter(null);
  };

  /** Swap position in sorted list, then renumber order 1…n so guest menu & nav stay consistent. */
  const moveCategory = useCallback(
    async (id, delta) => {
      setCategoryError(null);
      let orderById = null;
      setCategories((prev) => {
        const sorted = [...prev].sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || a.id - b.id);
        const idx = sorted.findIndex((x) => x.id === id);
        const j = idx + delta;
        if (idx < 0 || j < 0 || j >= sorted.length) return prev;
        const copy = [...sorted];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        const map = {};
        copy.forEach((cat, i) => {
          map[cat.id] = i + 1;
        });
        orderById = map;
        return prev.map((c) => ({ ...c, order: map[c.id] ?? c.order }));
      });
      if (!syncDishesToSupabase || !orderById) return;
      try {
        await updateMenuCategorySortOrders(orderById);
        clearMenuError();
      } catch (e) {
        setCategoryError(e?.message || "Could not save category order");
      }
    },
    [setCategories, syncDishesToSupabase, clearMenuError]
  );

  const dishesByCatSorted = useMemo(() => {
    const m = new Map();
    for (const d of dishes) {
      const k = String(d.categoryId);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(d);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id)));
    }
    return m;
  }, [dishes]);

  const shownSorted = useMemo(() => {
    const base =
      filter != null ? dishes.filter((d) => sameCategoryId(d.categoryId, filter)) : [...dishes];
    const byOrder = (a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id));
    if (filter != null) return base.sort(byOrder);
    const catIdx = new Map(sortedCats.map((c, i) => [String(c.id), i]));
    return base.sort((a, b) => {
      const ia = catIdx.has(String(a.categoryId)) ? catIdx.get(String(a.categoryId)) : 999;
      const ib = catIdx.has(String(b.categoryId)) ? catIdx.get(String(b.categoryId)) : 999;
      if (ia !== ib) return ia - ib;
      return byOrder(a, b);
    });
  }, [dishes, filter, sortedCats]);

  const moveDish = useCallback(
    async (dishId, delta) => {
      setDishCloudErr(null);
      const row = dishes.find((d) => String(d.id) === String(dishId));
      if (!row) return;
      const catId = row.categoryId;
      let orderById = null;
      setDishes((prev) => {
        const inCat = prev.filter((d) => sameCategoryId(d.categoryId, catId));
        const sorted = [...inCat].sort((a, b) => ((a.order ?? 0) - (b.order ?? 0)) || String(a.id).localeCompare(String(b.id)));
        const idx = sorted.findIndex((x) => String(x.id) === String(dishId));
        const j = idx + delta;
        if (idx < 0 || j < 0 || j >= sorted.length) return prev;
        const copy = [...sorted];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        const map = {};
        copy.forEach((d, i) => {
          map[d.id] = i + 1;
        });
        orderById = map;
        return prev.map((d) =>
          sameCategoryId(d.categoryId, catId) ? { ...d, order: map[d.id] ?? d.order ?? 0 } : d
        );
      });
      if (!syncDishesToSupabase || !orderById) return;
      setDishSaving(true);
      try {
        await updateMenuDishSortOrders(orderById);
        clearMenuError();
      } catch (e) {
        setDishCloudErr(e?.message || "Could not save dish order");
      } finally {
        setDishSaving(false);
      }
    },
    [dishes, syncDishesToSupabase, clearMenuError]
  );

  const tabBtn = (active) => ({
    padding: "8px 18px",
    border: `1px solid ${active ? "var(--gold)" : "rgba(61,191,176,0.15)"}`,
    background: active ? "rgba(61,191,176,0.12)" : "transparent",
    color: active ? "var(--gold)" : "var(--muted)",
    fontSize: "9px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    borderRadius: "2px",
  });

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Cuisine" sub="Menu Management"
        action={
          adminTab === "dishes" ? (
            <button onClick={openNew} style={{ padding:"10px 22px", background:"linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>+ NEW DISH</button>
          ) : (
            <button onClick={openNewCategory} style={{ padding:"10px 22px", background:"linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>+ NEW CATEGORY</button>
          )
        } />

      <div style={{ display:"flex", gap:"8px", marginBottom:"20px" }}>
        <button type="button" onClick={() => { setCategoryError(null); setAdminTab("dishes"); }} style={tabBtn(adminTab === "dishes")}>Dishes</button>
        <button type="button" onClick={() => { setCategoryError(null); setAdminTab("categories"); }} style={tabBtn(adminTab === "categories")}>Categories</button>
      </div>

      {adminTab === "categories" && (
        <>
          {categoryError && (
            <div style={{ marginBottom:"16px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", letterSpacing:"0.3px" }}>{categoryError}</div>
          )}
          {syncDishesToSupabase && (
            <div style={{ marginBottom:"16px", padding:"10px 14px", border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.06)", color:"#86efac", fontSize:"10px", letterSpacing:"0.3px", lineHeight:1.5 }}>
              კატეგორიები იტვირთება და ინახება Supabase-ში — ცხრილი <code style={{ color:"var(--gold)" }}>public.menu_categories</code> (SQL: <code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>).
            </div>
          )}
          <div style={{ fontSize:"10px", color:"var(--muted)", marginBottom:"12px", letterSpacing:"0.3px", lineHeight:1.5 }}>
            ↑ / ↓ — ჯგუფების თანმიმდევრობა სტუმრის მენიუში; ყოველი გადაადგილების შემდეგ ნომრები (order) აივსება 1-დან ბოლომდე.
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:"12px", marginBottom:"24px" }}>
            {sortedCats.map((c, idx) => (
              <div key={c.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", padding:"20px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
                  <div style={{ fontSize:"22px", color:"var(--gold)", opacity:0.85 }}>{c.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--cream)" }}>{c.name.en || c.name.ka || c.name.ru || "—"}</div>
                    <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"6px", lineHeight:1.5 }}>
                      <span style={{ color:"var(--subtle)" }}>KA</span> {c.name.ka || "—"}<br />
                      <span style={{ color:"var(--subtle)" }}>RU</span> {c.name.ru || "—"}
                    </div>
                    <div style={{ fontSize:"9px", color:"var(--subtle)", marginTop:"8px", letterSpacing:"1px" }}>ORDER · {c.order ?? 0} · ID {c.id}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"6px", marginTop:"16px", flexWrap:"wrap" }}>
                  <button type="button" aria-label="Move up" disabled={idx === 0 || catSaving} onClick={() => moveCategory(c.id, -1)} style={{
                    padding:"8px 12px", background: idx === 0 || catSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${idx === 0 || catSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: idx === 0 || catSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: idx === 0 || catSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: idx === 0 || catSaving ? 0.45 : 1,
                  }}>↑</button>
                  <button type="button" aria-label="Move down" disabled={idx === sortedCats.length - 1 || catSaving} onClick={() => moveCategory(c.id, 1)} style={{
                    padding:"8px 12px", background: idx === sortedCats.length - 1 || catSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${idx === sortedCats.length - 1 || catSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: idx === sortedCats.length - 1 || catSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: idx === sortedCats.length - 1 || catSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: idx === sortedCats.length - 1 || catSaving ? 0.45 : 1,
                  }}>↓</button>
                  <button type="button" disabled={catSaving} onClick={() => openEditCategory(c)} style={{ flex:1, minWidth:"100px", padding:"8px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"1.5px", cursor: catSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: catSaving ? 0.6 : 1 }}>EDIT</button>
                  <button type="button" disabled={catSaving} onClick={() => delCategory(c.id)} style={{ padding:"8px 12px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.75)", fontSize:"11px", cursor: catSaving ? "wait" : "pointer", opacity: catSaving ? 0.6 : 1 }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {adminTab === "dishes" && (
      <>
      {syncDishesToSupabase && menuError && (
        <div style={{ marginBottom:"20px", padding:"12px 14px", border:"1px solid rgba(234,179,8,0.35)", background:"rgba(234,179,8,0.08)", color:"#fde68a", fontSize:"11px", lineHeight:1.55, letterSpacing:"0.2px" }}>
          Supabase-მდე მენიუ ვერ ჩაიტვირთა: <strong style={{ color:"#fef3c7" }}>{menuError}</strong> — შეამოწმე ცხრილი <code style={{ color:"var(--gold)" }}>menu</code>, RLS და <code style={{ color:"var(--gold)" }}>.env.local</code>. Cuisine-ის ცვლილებები მაინც ინახება მხოლოდ Supabase-ში (ლოკალური სია აღარ გამოიყენება).
        </div>
      )}
      {syncDishesToSupabase && !menuError && (
        <div style={{ marginBottom:"16px", padding:"10px 14px", border:"1px solid rgba(16,185,129,0.25)", background:"rgba(16,185,129,0.06)", color:"#86efac", fontSize:"10px", letterSpacing:"0.3px" }}>
          მენიუ იტვირთება Supabase-იდან — კერძები: <code style={{ color:"var(--gold)" }}>public.menu</code>; კატეგორიები (ჩანართი Categories): <code style={{ color:"var(--gold)" }}>public.menu_categories</code>.
        </div>
      )}
      <div style={{ display:"flex", gap:"6px", marginBottom:"24px", flexWrap:"wrap" }}>
        <CatBtn active={!filter} onClick={()=>setFilter(null)} label="All" />
        {sortedCats.map((c) => (
          <CatBtn
            key={c.id}
            active={filter != null && sameCategoryId(filter, c.id)}
            onClick={() => setFilter(c.id)}
            label={c.name.en}
            icon={c.icon}
          />
        ))}
      </div>

      <div style={{ fontSize:"10px", color:"var(--muted)", marginBottom:"12px", letterSpacing:"0.3px", lineHeight:1.5 }}>
        ↑ / ↓ — კერძის თანმიმდევრობა იმავე კატეგორიაში (სტუმრის მენიუ). Supabase: გაუშვი SQL ცხრილზე <code style={{ color:"var(--gold)" }}>sort_order</code> თუ ბაზა ძველია (<code style={{ color:"var(--gold)" }}>supabase/schema.sql</code>).
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(100%, 260px), 1fr))", gap:"12px" }}>
        {shownSorted.map(dish => {
          const cat = categories.find((c) => sameCategoryId(c.id, dish.categoryId));
          const sibs = dishesByCatSorted.get(String(dish.categoryId)) || [];
          const di = sibs.findIndex((x) => String(x.id) === String(dish.id));
          const mmAd = minMaxVariantPrice(dish);
          return (
            <div key={dish.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", overflow:"hidden" }}>
              <div style={{ position:"relative", height:"160px" }}>
                <img
                  src={dish.image}
                  alt=""
                  width={400}
                  height={160}
                  loading="lazy"
                  decoding="async"
                  style={{ width:"100%", height:"160px", objectFit:"cover", display:"block", filter:dish.available?"none":"grayscale(1) opacity(0.5)" }}
                />
                <div style={{ position:"absolute", inset:0, background:"linear-gradient(0deg, rgba(7,6,8,0.7) 0%, transparent 60%)" }} />
                <div style={{ position:"absolute", bottom:"10px", left:"12px", right:"12px", display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:"18px", fontStyle:"italic", color:"#fff" }}>{dish.name.en}</div>
                  <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", color:"var(--gold-light)" }}>
                    {mmAd ? `₾${formatLari(mmAd.min)}–${formatLari(mmAd.max)}` : `₾${formatLari(dish.price)}`}
                  </div>
                </div>
                <div style={{ position:"absolute", top:"8px", right:"8px", display:"flex", gap:"4px", flexWrap:"wrap" }}>
                  {dish.badges.map((b, bi) => <span key={`${dish.id}-ab-${bi}-${b}`} style={{ background:BADGE_CFG[b]?.bg||"#333", color:BADGE_CFG[b]?.color||"#fff", fontSize:"7px", padding:"2px 6px", fontWeight:"700", letterSpacing:"1px" }}>{b}</span>)}
                </div>
              </div>
              <div style={{ padding:"14px 14px 10px" }}>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"1px", marginBottom:"10px" }}>{cat?.icon} {cat?.name.en}</div>
                <div style={{ display:"flex", gap:"6px", marginBottom:"8px" }}>
                  <button type="button" aria-label="Move dish up" disabled={di <= 0 || dishSaving} onClick={() => moveDish(dish.id, -1)} style={{
                    padding:"8px 12px", background: di <= 0 || dishSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${di <= 0 || dishSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: di <= 0 || dishSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: di <= 0 || dishSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: di <= 0 || dishSaving ? 0.45 : 1,
                  }}>↑</button>
                  <button type="button" aria-label="Move dish down" disabled={di < 0 || di >= sibs.length - 1 || dishSaving} onClick={() => moveDish(dish.id, 1)} style={{
                    padding:"8px 12px", background: di < 0 || di >= sibs.length - 1 || dishSaving ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.08)", border:`1px solid ${di < 0 || di >= sibs.length - 1 || dishSaving ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.25)"}`,
                    color: di < 0 || di >= sibs.length - 1 || dishSaving ? "var(--subtle)" : "var(--gold)", fontSize:"14px", cursor: di < 0 || di >= sibs.length - 1 || dishSaving ? "not-allowed" : "pointer", lineHeight:1, opacity: di < 0 || di >= sibs.length - 1 || dishSaving ? 0.45 : 1,
                  }}>↓</button>
                </div>
                <div style={{ display:"flex", gap:"6px" }}>
                  <button type="button" disabled={dishSaving} onClick={()=>openEdit(dish)} style={{ flex:1, padding:"7px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"1.5px", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: dishSaving ? 0.6 : 1 }}>EDIT</button>
                  <button type="button" disabled={dishSaving} onClick={()=>toggle(dish.id)} style={{ flex:1, padding:"7px", background:dish.available?"rgba(16,185,129,0.06)":"rgba(239,68,68,0.06)", border:`1px solid ${dish.available?"rgba(16,185,129,0.2)":"rgba(239,68,68,0.2)"}`, color:dish.available?"#10b981":"#ef4444", fontSize:"9px", letterSpacing:"1.5px", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)", opacity: dishSaving ? 0.6 : 1 }}>
                    {dish.available?"ACTIVE":"OFF"}
                  </button>
                  <button type="button" disabled={dishSaving} onClick={()=>del(dish.id)} style={{ padding:"7px 10px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.7)", fontSize:"11px", cursor: dishSaving ? "wait" : "pointer", opacity: dishSaving ? 0.6 : 1 }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}

      {catModal !== null && catForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(8px)", padding:"20px" }}>
          <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.2)", padding:"36px", width:"100%", maxWidth:"520px", maxHeight:"85vh", overflowY:"auto", animation:"slideIn 0.3s ease" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"28px", fontStyle:"italic", color:"var(--cream)", marginBottom:"24px" }}>
              {catModal === "new" ? "New Category" : "Edit Category"}
            </div>
            {categoryError && <div style={{ marginBottom:"14px", fontSize:"11px", color:"#fca5a5" }}>{categoryError}</div>}
            <CategoryFormAdmin form={catForm} setForm={setCatForm} />
            <div style={{ display:"flex", gap:"10px", marginTop:"24px" }}>
              <button type="button" disabled={catSaving} onClick={() => saveCategory()} style={{ flex:1, padding:"13px", background: catSaving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: catSaving ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>SAVE</button>
              <button type="button" disabled={catSaving} onClick={() => { setCatModal(null); setCatForm(null); setCategoryError(null); }} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"var(--muted)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: catSaving ? "not-allowed" : "pointer", fontFamily:"var(--font-body)" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {modal!==null && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(8px)", padding:"20px" }}>
          <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.2)", padding:"36px", width:"100%", maxWidth:"560px", maxHeight:"85vh", overflowY:"auto", animation:"slideIn 0.3s ease" }}>
            <div style={{ fontFamily:"var(--font-display)", fontSize:"28px", fontStyle:"italic", color:"var(--cream)", marginBottom:"28px" }}>
              {modal==="new"?"New Dish":"Edit Dish"}
            </div>
            {dishCloudErr && (
              <div style={{ marginBottom:"16px", padding:"12px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px" }}>{dishCloudErr}</div>
            )}
            <DishFormAdmin form={form} setForm={setForm} categories={sortedCats} />
            <div style={{ display:"flex", gap:"10px", marginTop:"24px" }}>
              <button type="button" disabled={dishSaving} onClick={() => save()} style={{ flex:1, padding:"13px", background: dishSaving ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,rgba(61,191,176,0.2),rgba(61,191,176,0.08))", border:"1px solid var(--gold)", color:"var(--gold-pale)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: dishSaving ? "wait" : "pointer", fontFamily:"var(--font-body)" }}>SAVE</button>
              <button type="button" disabled={dishSaving} onClick={() => setModal(null)} style={{ flex:1, padding:"13px", background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"var(--muted)", fontSize:"9px", letterSpacing:"3px", textTransform:"uppercase", cursor: dishSaving ? "not-allowed" : "pointer", fontFamily:"var(--font-body)" }}>CANCEL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryFormAdmin({ form, setForm }) {
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setL = (f, l, v) => setForm(p => ({ ...p, [f]: { ...p[f], [l]: v } }));
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"6px", display:"block" };
  const inputStyle = { width:"100%", padding:"10px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", boxSizing:"border-box", letterSpacing:"0.5px" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      <div>
        <label style={labelStyle}>Icon (symbol)</label>
        <input value={form.icon ?? ""} onChange={e => set("icon", e.target.value.slice(0, 2))} style={{ ...inputStyle, maxWidth:"100px", fontFamily:"var(--font-display)", fontSize:"20px" }} />
      </div>
      <div>
        <label style={labelStyle}>Sort order</label>
        <input type="number" value={form.order === "" || form.order === undefined ? "" : form.order} onChange={e => set("order", e.target.value === "" ? "" : Number(e.target.value))} style={{ ...inputStyle, fontFamily:"var(--font-body)", fontSize:"13px" }} />
      </div>
      {["en","ka","ru"].map(l => (
        <div key={l}>
          <label style={labelStyle}>Name ({l.toUpperCase()})</label>
          <input value={form.name[l] ?? ""} onChange={e => setL("name", l, e.target.value)} style={inputStyle} />
        </div>
      ))}
    </div>
  );
}

function DishFormAdmin({ form, setForm, categories }) {
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  const setL = (f,l,v) => setForm(p=>({...p,[f]:{...p[f],[l]:v}}));
  const labelStyle = { fontSize:"8px", color:"var(--gold)", letterSpacing:"3px", textTransform:"uppercase", marginBottom:"6px", display:"block" };
  const inputStyle = { width:"100%", padding:"10px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", boxSizing:"border-box", letterSpacing:"0.5px" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
      <div>
        <label style={labelStyle}>Category</label>
        <select
          value={form.categoryId === undefined || form.categoryId === null ? "" : String(form.categoryId)}
          onChange={(e) => {
            const v = e.target.value;
            set("categoryId", v === "" ? undefined : Number(v));
          }}
          style={{ ...inputStyle, fontFamily: "var(--font-body)", fontSize: "12px" }}
        >
          {categories.length === 0 ? (
            <option value="" style={{ background: "var(--charcoal)" }}>— ჯგუფი არაა —</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id} style={{ background: "var(--charcoal)" }}>{c.name.en}</option>
            ))
          )}
        </select>
      </div>
      {["en","ka","ru"].map(l=>(
        <div key={l}>
          <label style={labelStyle}>Name ({l.toUpperCase()})</label>
          <input value={form.name[l]} onChange={e=>setL("name",l,e.target.value)} style={inputStyle} />
        </div>
      ))}
      {["en", "ka", "ru"].map((l) => (
        <div key={l}>
          <label style={labelStyle}>
            {l === "en" ? "Description (EN)" : l === "ka" ? "აღწერა (KA)" : "Описание (RU)"}
          </label>
          <textarea
            value={form.description[l] ?? ""}
            onChange={(e) => setL("description", l, e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        <div><label style={labelStyle}>Price (₾)</label><input type="number" min={0} step="any" inputMode="decimal" value={form.price === "" || form.price == null ? "" : form.price} onChange={(e) => set("price", e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Image URL</label><input value={form.image} onChange={e=>set("image",e.target.value)} style={inputStyle} /></div>
      </div>
      <div>
        <label style={labelStyle}>Sizes / prices (optional)</label>
        <div style={{ fontSize:"10px", color:"var(--muted)", marginBottom:"10px", lineHeight:1.5 }}>
          Leave empty for a single price only. For wine: add rows (e.g. <strong style={{ color:"var(--cream)" }}>bottle</strong> / <strong style={{ color:"var(--cream)" }}>glass</strong>) with ID, ₾, and labels — guest menu opens the picker modal.
        </div>
        {(form.priceVariants || []).map((v, i) => (
          <div
            key={`pv-${i}-${v.id}`}
            style={{
              border: "1px solid rgba(61,191,176,0.18)",
              borderRadius: "6px",
              padding: "12px 12px 10px",
              marginBottom: "10px",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, fontSize: "7px" }}>Variant ID</label>
                <input
                  value={v.id ?? ""}
                  onChange={(e) => {
                    const nv = [...(form.priceVariants || [])];
                    nv[i] = { ...nv[i], id: e.target.value };
                    setForm((p) => ({ ...p, priceVariants: nv }));
                  }}
                  placeholder="bottle"
                  style={{ ...inputStyle, fontFamily: "var(--font-body)", fontSize: "12px" }}
                />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: "7px" }}>Price (₾)</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  value={v.price === "" || v.price == null ? "" : v.price}
                  onChange={(e) => {
                    const nv = [...(form.priceVariants || [])];
                    nv[i] = { ...nv[i], price: e.target.value };
                    setForm((p) => ({ ...p, priceVariants: nv }));
                  }}
                  style={{ ...inputStyle, fontFamily: "var(--font-body)", fontSize: "12px" }}
                />
              </div>
            </div>
            {["en", "ka", "ru"].map((l) => (
              <div key={l} style={{ marginBottom: "8px" }}>
                <label style={{ ...labelStyle, fontSize: "7px" }}>Label ({l.toUpperCase()})</label>
                <input
                  value={v.label?.[l] ?? ""}
                  onChange={(e) => {
                    const nv = [...(form.priceVariants || [])];
                    nv[i] = { ...nv[i], label: { ...(nv[i].label || {}), [l]: e.target.value } };
                    setForm((p) => ({ ...p, priceVariants: nv }));
                  }}
                  style={{ ...inputStyle, fontFamily: "var(--font-body)", fontSize: "12px" }}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  priceVariants: (p.priceVariants || []).filter((_, j) => j !== i),
                }))
              }
              style={{
                marginTop: "4px",
                padding: "6px 12px",
                fontSize: "9px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                border: "1px solid rgba(239,68,68,0.35)",
                background: "transparent",
                color: "#fca5a5",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Remove row
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setForm((p) => ({
              ...p,
              priceVariants: [...(p.priceVariants || []), { id: `v${Date.now()}`, price: "", label: { en: "", ka: "", ru: "" } }],
            }))
          }
          style={{
            padding: "8px 14px",
            fontSize: "9px",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            border: "1px solid rgba(61,191,176,0.35)",
            background: "rgba(61,191,176,0.08)",
            color: "var(--gold-pale)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          + Add size / price row
        </button>
      </div>
      <div>
        <label style={labelStyle}>Distinctions</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"6px" }}>
          {Object.keys(BADGE_CFG).map(b=>(
            <button key={b} onClick={()=>set("badges",form.badges.includes(b)?form.badges.filter(x=>x!==b):[...form.badges,b])} style={{ padding:"5px 12px", border:"1px solid", borderColor:form.badges.includes(b)?"var(--gold)":"rgba(61,191,176,0.15)", background:form.badges.includes(b)?"rgba(61,191,176,0.12)":"transparent", color:form.badges.includes(b)?"var(--gold)":"var(--muted)", fontSize:"9px", letterSpacing:"1px", cursor:"pointer", fontFamily:"var(--font-body)" }}>{b}</button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:"20px" }}>
        {[["available","✦ Available"],["featured","◈ Featured"]].map(([k,l])=>(
          <label key={k} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", fontSize:"11px", color:"var(--muted)" }}>
            <input type="checkbox" checked={form[k]} onChange={e=>set(k,e.target.checked)} /> {l}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Full URL to guest menu with table (for QR scanners). */
function menuUrlForTable(tableId) {
  const base = import.meta.env.BASE_URL || "/";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  try {
    return new URL(`?table=${encodeURIComponent(String(tableId))}`, origin + base).href;
  } catch {
    const b = String(base).replace(/\/?$/, "/");
    return `${origin}${b}?table=${encodeURIComponent(String(tableId))}`;
  }
}

function TableQrImage({ tableId, tableName, zone }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);
  const url = useMemo(() => menuUrlForTable(tableId), [tableId]);

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    QRCode.toDataURL(url, {
      width: 240,
      margin: 2,
      color: { dark: "#0f1818", light: "#d4f7f2" },
      errorCorrectionLevel: "M",
    })
      .then((d) => { if (!cancelled) setDataUrl(d); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <div style={{ textAlign:"center", padding:"16px", background:"linear-gradient(160deg, #d4f7f2, #f5ddd6)", marginBottom:"14px" }}>
      {dataUrl && (
        <img
          src={dataUrl}
          alt={`QR: ${tableName}`}
          width={160}
          height={160}
          loading="lazy"
          decoding="async"
          style={{ width:"160px", height:"160px", display:"block", margin:"0 auto", imageRendering:"pixelated" }}
        />
      )}
      {!dataUrl && !failed && (
        <div style={{ fontSize:"10px", color:"#333", padding:"48px 8px" }}>…</div>
      )}
      {failed && <div style={{ fontSize:"10px", color:"#991b1b" }}>QR failed</div>}
      <div style={{ marginTop:"10px", fontSize:"8px", color:"#444", letterSpacing:"0.3px", fontFamily:"var(--font-body)", wordBreak:"break-all", lineHeight:1.4 }}>
        {url}
      </div>
      <div style={{ marginTop:"6px", fontSize:"9px", color:"#555" }}>{tableName} · {zone}</div>
    </div>
  );
}

/* ─── Tables ──────────────────────────────────────────────────────────── */
function AdminTables({ store }) {
  const { tables, tablesLoading, tablesError, addTableRow, toggleTableRow, removeTableRow, reloadSeatingFromSupabase } = store;
  const [name, setName] = useState(""); const [zone, setZone] = useState("Grand Hall");
  const [qr, setQr] = useState(null);
  const [seatErr, setSeatErr] = useState(null);

  const add = async () => {
    if (!name.trim()) return;
    setSeatErr(null);
    try {
      await addTableRow(name.trim(), zone);
      setName("");
    } catch (e) {
      setSeatErr(e?.message || "Save failed");
    }
  };
  const toggle = async (id) => {
    setSeatErr(null);
    try {
      await toggleTableRow(id);
    } catch (e) {
      setSeatErr(e?.message || "Update failed");
    }
  };
  const del = async (id) => {
    setSeatErr(null);
    try {
      await removeTableRow(id);
    } catch (e) {
      setSeatErr(e?.message || "Delete failed");
    }
  };

  const inputStyle = { padding:"11px 0", background:"transparent", border:"none", borderBottom:"1px solid rgba(61,191,176,0.2)", color:"var(--cream)", fontSize:"14px", fontFamily:"var(--font-display)", outline:"none", width:"100%", boxSizing:"border-box" };

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader
        title="Seating"
        sub={isSupabaseConfigured() ? "Table Management · Supabase (all devices)" : "Table Management · this browser only"}
        action={
          isSupabaseConfigured() ? (
            <button
              type="button"
              onClick={() => {
                setSeatErr(null);
                reloadSeatingFromSupabase().catch((e) => setSeatErr(e?.message || "Reload failed"));
              }}
              style={{ padding:"9px 18px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.25)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}
            >
              RELOAD FROM CLOUD
            </button>
          ) : null
        }
      />

      {(tablesError || seatErr) && (
        <div style={{ marginBottom:"16px", padding:"12px 14px", border:"1px solid rgba(239,68,68,0.35)", background:"rgba(239,68,68,0.08)", color:"#fca5a5", fontSize:"11px", lineHeight:1.5 }}>
          {seatErr || tablesError}
        </div>
      )}
      {tablesLoading && tables.length === 0 && (
        <div style={{ marginBottom:"16px", fontSize:"12px", color:"var(--muted)" }}>Loading tables…</div>
      )}

      <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.15)", padding:"28px", marginBottom:"28px" }}>
        <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"20px" }}>Add Table</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:"20px", alignItems:"end" }}>
          <div><div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"2px", marginBottom:"6px" }}>TABLE NAME</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Salon Privé" style={inputStyle} /></div>
          <div>
            <div style={{ fontSize:"8px", color:"var(--muted)", letterSpacing:"2px", marginBottom:"6px" }}>ZONE</div>
            <select value={zone} onChange={e=>setZone(e.target.value)} style={{...inputStyle,fontFamily:"var(--font-body)",fontSize:"12px"}}>
              {["Grand Hall","VIP","Terrace","Bar","Private"].map(z=><option key={z} style={{background:"var(--charcoal)"}}>{z}</option>)}
            </select>
          </div>
          <button type="button" onClick={add} disabled={tablesLoading} style={{ padding:"11px 24px", background:"rgba(61,191,176,0.12)", border:"1px solid var(--gold)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", textTransform:"uppercase", cursor: tablesLoading ? "wait" : "pointer", fontFamily:"var(--font-body)", whiteSpace:"nowrap", opacity: tablesLoading ? 0.6 : 1 }}>ADD</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"12px" }}>
        {tables.map(tb => (
          <div key={tb.id} style={{ background:"var(--charcoal)", border:"1px solid rgba(255,255,255,0.06)", padding:"22px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"16px" }}>
              <div>
                <div style={{ fontFamily:"var(--font-display)", fontSize:"20px", fontStyle:"italic", color:"var(--cream)" }}>{tb.name}</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:"2px", marginTop:"2px" }}>{tb.zone}</div>
                <div style={{ fontSize:"8px", color:"var(--subtle)", marginTop:"6px", letterSpacing:"1px", wordBreak:"break-all" }}>{menuUrlForTable(tb.id)}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:tb.active?"#10b981":"var(--subtle)", animation:tb.active?"pulse 2s infinite":"none" }} />
                <span style={{ fontSize:"8px", color:tb.active?"#10b981":"var(--subtle)", letterSpacing:"1.5px" }}>{tb.active?"LIVE":"OFF"}</span>
              </div>
            </div>

            {qr===tb.id && <TableQrImage tableId={tb.id} tableName={tb.name} zone={tb.zone} />}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr auto", gap:"6px" }}>
              <button onClick={()=>setQr(qr===tb.id?null:tb.id)} style={{ padding:"8px", background:"rgba(139,92,246,0.08)", border:"1px solid rgba(139,92,246,0.2)", color:"#a78bfa", fontSize:"8px", letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>
                {qr===tb.id?"HIDE":"QR"}
              </button>
              <button onClick={()=>toggle(tb.id)} style={{ padding:"8px", background:tb.active?"rgba(239,68,68,0.06)":"rgba(16,185,129,0.06)", border:`1px solid ${tb.active?"rgba(239,68,68,0.2)":"rgba(16,185,129,0.2)"}`, color:tb.active?"#ef4444":"#10b981", fontSize:"8px", letterSpacing:"1.5px", textTransform:"uppercase", cursor:"pointer", fontFamily:"var(--font-body)" }}>
                {tb.active?"PAUSE":"START"}
              </button>
              <button onClick={()=>del(tb.id)} style={{ padding:"8px 10px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.1)", color:"rgba(239,68,68,0.5)", cursor:"pointer", fontSize:"11px" }}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Alerts ──────────────────────────────────────────────────────────── */
function AdminAlerts({ store }) {
  const { notifications, setNotifications } = store;
  const unread = notifications.filter(n=>!n.read).length;

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Alerts" sub={`${unread} Unread Notifications`}
        action={
          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={()=>setNotifications(p=>p.map(n=>({...n,read:true})))} style={{ padding:"9px 18px", background:"rgba(61,191,176,0.08)", border:"1px solid rgba(61,191,176,0.2)", color:"var(--gold)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}>MARK READ</button>
            <button onClick={()=>setNotifications([])} style={{ padding:"9px 18px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", color:"rgba(239,68,68,0.7)", fontSize:"9px", letterSpacing:"2px", cursor:"pointer", fontFamily:"var(--font-body)" }}>CLEAR ALL</button>
          </div>
        } />

      {notifications.length===0 ? (
        <div style={{ textAlign:"center", padding:"80px 0", fontFamily:"var(--font-display)", fontSize:"22px", fontStyle:"italic", color:"var(--subtle)" }}>No alerts at this time</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {notifications.map(n => {
            const vis = notificationVisual(n.type);
            return (
            <div key={n.id} onClick={()=>setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))} style={{
              display:"flex", gap:"16px", alignItems: n.type==="order" ? "flex-start" : "center",
              padding:"18px 20px", background: n.read?"rgba(255,255,255,0.015)":"rgba(61,191,176,0.04)",
              border:`1px solid ${n.read?"rgba(255,255,255,0.05)":"rgba(61,191,176,0.15)"}`,
              borderLeft:`3px solid ${vis.accent}`,
              cursor:"pointer", transition:"all 0.2s",
            }}>
              <div style={{ width:"36px", height:"36px", background: vis.sheetBg, border:`1px solid ${vis.sheetBd}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"14px", flexShrink:0, color: vis.accent }}>
                {vis.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"14px", fontFamily:"var(--font-display)", fontStyle:"italic", color: n.read?"var(--muted)":"var(--cream)" }}>{n.tableName}</div>
                <div style={{ fontSize:"10px", color:"var(--muted)", marginTop:"2px", letterSpacing:"0.5px", whiteSpace: n.type==="order" ? "pre-wrap" : "normal", lineHeight: 1.45, wordBreak: "break-word" }}>{n.message}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:"11px", color:"var(--gold)", fontFamily:"var(--font-display)" }}>{n.time?.toLocaleTimeString()}</div>
                {!n.read && <div style={{ fontSize:"7px", letterSpacing:"2px", color:"var(--gold)", marginTop:"4px" }}>NEW</div>}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Staff: ჯერ აირჩიე დარბაზი — მერე მხოლოდ ამ ზონის მაგიდების შეტყობინებები. */
function StaffZonePicker({ zones, tablesLoading, onChooseZone, onLogout }) {
  return (
    <div className="staff-waiter-screen" style={{ minHeight: "100vh", background: "var(--obsidian)", color: "var(--cream)", position: "relative", display: "flex", flexDirection: "column" }}>
      <div className="noise" />
      <header
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid rgba(61,191,176,0.12)",
          background: "linear-gradient(180deg, rgba(15,18,20,0.98), rgba(15,18,20,0.88))",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: "8px", letterSpacing: "0.35em", color: "var(--gold)", textTransform: "uppercase" }}>მიმტანი</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontStyle: "italic", marginTop: 4 }}>აირჩიეთ დარბაზი</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "rgba(239,68,68,0.75)",
              fontSize: "9px",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              flexShrink: 0,
              touchAction: "manipulation",
            }}
          >
            გასვლა
          </button>
        </div>
      </header>
      <div style={{ flex: 1, padding: "20px 16px", overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        {tablesLoading && zones.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--muted)" }}>იტვირთება…</div>
        ) : zones.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "var(--subtle)", lineHeight: 1.6, fontSize: "14px" }}>
            მაგიდები ან დარბაზის ველი ჯერ არ ჩანს. ადმინში დაამატეთ მაგიდები ზონით (Grand Hall, Private…).
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {zones.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => onChooseZone(z)}
                style={{
                  minHeight: 88,
                  padding: "16px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(61,191,176,0.28)",
                  background: "linear-gradient(145deg, rgba(61,191,176,0.14), rgba(8,12,12,0.96))",
                  color: "var(--gold-pale)",
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(1.05rem, 3.5vw, 1.3rem)",
                  fontStyle: "italic",
                  cursor: "pointer",
                  textAlign: "center",
                  touchAction: "manipulation",
                }}
              >
                {z}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* მიმტანის სამუშაო ეკრანი — გამოძახება, ანგარიში, შეკვეთა (მხოლოდ არჩეული დარბაზის მაგიდები). */
function StaffAlertsScreen({ store, onLogout }) {
  const { notifications, setNotifications, tables, tablesLoading } = store;
  const zones = useMemo(() => uniqueZonesFromTables(tables), [tables]);
  const [staffZone, setStaffZone] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (zones.length === 0) {
      setStaffZone(null);
      return;
    }
    setStaffZone((prev) => {
      if (prev != null && zones.includes(prev)) return prev;
      const fromSession = readStaffZoneSession(zones);
      return fromSession || null;
    });
  }, [zones]);

  useEffect(() => {
    if (staffZone == null) return;
    if (!zones.includes(staffZone)) setStaffZone(null);
  }, [zones, staffZone]);

  const notificationsForZone = useMemo(
    () =>
      notifications.filter((n) => {
        const z = resolveNotificationZone(n, tables);
        return z != null && staffZone != null && z === staffZone;
      }),
    [notifications, tables, staffZone]
  );

  const goPickZone = useCallback(() => {
    clearStaffZoneSession();
    setStaffZone(null);
  }, []);

  const pickLogout = useCallback(() => {
    clearStaffZoneSession();
    onLogout();
  }, [onLogout]);

  const unread = notificationsForZone.filter((n) => !n.read).length;
  useUnreadAlertSound(unread);

  const filtered = useMemo(() => {
    if (filter === "waiter") return notificationsForZone.filter((n) => n.type === "waiter");
    if (filter === "bill") return notificationsForZone.filter((n) => n.type === "bill");
    if (filter === "order") return notificationsForZone.filter((n) => n.type === "order");
    return notificationsForZone;
  }, [notificationsForZone, filter]);

  const unreadByType = useMemo(() => {
    const open = notificationsForZone.filter((n) => !n.read);
    return {
      waiter: open.filter((n) => n.type === "waiter").length,
      bill: open.filter((n) => n.type === "bill").length,
      order: open.filter((n) => n.type === "order").length,
    };
  }, [notificationsForZone]);

  if (staffZone == null) {
    return (
      <StaffZonePicker
        zones={zones}
        tablesLoading={tablesLoading}
        onChooseZone={(z) => {
          setStaffZone(z);
          writeStaffZoneSession(z);
        }}
        onLogout={pickLogout}
      />
    );
  }

  const chip = (id, labelKa, extra) => (
    <button
      type="button"
      key={id}
      onClick={() => setFilter(id)}
      style={{
        flex: 1,
        minHeight: 48,
        padding: "12px 10px",
        border: filter === id ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.08)",
        background: filter === id ? "rgba(61,191,176,0.12)" : "rgba(255,255,255,0.03)",
        color: filter === id ? "var(--gold-pale)" : "var(--muted)",
        fontSize: "11px",
        fontWeight: filter === id ? 600 : 400,
        letterSpacing: "0.06em",
        cursor: "pointer",
        fontFamily: "var(--font-body)",
        borderRadius: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        touchAction: "manipulation",
      }}
    >
      <span>{labelKa}</span>
      {extra != null && extra > 0 && (
        <span style={{ fontSize: "10px", background: "#7f1d1d", color: "#fca5a5", padding: "2px 8px", borderRadius: 999 }}>{extra}</span>
      )}
    </button>
  );

  return (
    <div className="staff-waiter-screen" style={{ minHeight: "100vh", background: "var(--obsidian)", color: "var(--cream)", position: "relative", display: "flex", flexDirection: "column" }}>
      <div className="noise" />
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          padding: "16px 18px",
          background: "linear-gradient(180deg, rgba(15,18,20,0.98), rgba(15,18,20,0.88))",
          borderBottom: "1px solid rgba(61,191,176,0.12)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "8px", letterSpacing: "0.35em", color: "var(--gold)", textTransform: "uppercase" }}>მიმტანი</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.35rem, 4vw, 1.75rem)", fontStyle: "italic", fontWeight: 300, marginTop: 4 }}>
              გამოძახება · ანგარიში · შეკვეთა
            </div>
            <div style={{ fontSize: "12px", color: "var(--gold-pale)", marginTop: 6, fontWeight: 500, letterSpacing: "0.04em" }}>{staffZone}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={goPickZone}
              style={{
                padding: "8px 12px",
                background: "rgba(61,191,176,0.08)",
                border: "1px solid rgba(61,191,176,0.3)",
                color: "var(--gold)",
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                touchAction: "manipulation",
              }}
            >
              დარბაზი
            </button>
            <button
              type="button"
              onClick={pickLogout}
              style={{
                padding: "8px 12px",
                background: "transparent",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "rgba(239,68,68,0.75)",
                fontSize: "8px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                touchAction: "manipulation",
              }}
            >
              გასვლა
            </button>
          </div>
        </div>
      </header>

      {unread > 0 && (
        <div
          className="staff-alert-banner"
          style={{
            margin: "12px 16px 0",
            padding: "16px 18px",
            borderRadius: 14,
            background: "linear-gradient(135deg, rgba(127,29,29,0.45), rgba(61,191,176,0.12))",
            border: "1px solid rgba(248,113,113,0.35)",
            boxShadow: "0 0 40px rgba(248,113,113,0.12)",
            textAlign: "center",
            animation: "staffPulse 2s ease-in-out infinite",
          }}
        >
          <div style={{ fontSize: "11px", letterSpacing: "0.4em", color: "#fecaca", fontWeight: 700 }}>ALERT</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.5rem, 5vw, 2rem)", marginTop: 6, color: "#fff7ed" }}>
            {unread} ახალი მოთხოვნა
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 8 }}>
            მიმტანი: {unreadByType.waiter} · ანგარიში: {unreadByType.bill} · შეკვეთა: {unreadByType.order}
          </div>
        </div>
      )}

      <div style={{ padding: "16px", flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {chip("all", "ყველა", unread > 0 ? unread : null)}
          {chip("waiter", "გამოძახება", unreadByType.waiter || null)}
          {chip("bill", "ანგარიში", unreadByType.bill || null)}
          {chip("order", "შეკვეთა", unreadByType.order || null)}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() =>
              setNotifications((p) =>
                p.map((n) => (resolveNotificationZone(n, tables) === staffZone ? { ...n, read: true } : n))
              )
            }
            style={{
              padding: "12px 18px",
              background: "rgba(61,191,176,0.1)",
              border: "1px solid rgba(61,191,176,0.25)",
              color: "var(--gold)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              borderRadius: 999,
              touchAction: "manipulation",
            }}
          >
            ყველა წაკითხული
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && !window.confirm("ამ დარბაზის შეტყობინებები წაიშლება. გავაგრძელო?")) return;
              setNotifications((p) => p.filter((n) => resolveNotificationZone(n, tables) !== staffZone));
            }}
            style={{
              padding: "12px 18px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "rgba(239,68,68,0.85)",
              fontSize: "10px",
              letterSpacing: "0.12em",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              borderRadius: 999,
              touchAction: "manipulation",
            }}
          >
            სიის გასუფთავება
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", fontFamily: "var(--font-display)", fontSize: "1.25rem", fontStyle: "italic", color: "var(--subtle)" }}>
            ამ მონიშნულში მოთხოვნა არაა
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((n) => {
              const vis = notificationVisual(n.type);
              return (
              <button
                type="button"
                key={n.id}
                onClick={() => setNotifications((p) => p.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  padding: "18px 16px",
                  textAlign: "left",
                  width: "100%",
                  boxSizing: "border-box",
                  background: n.read ? "rgba(255,255,255,0.02)" : "rgba(61,191,176,0.06)",
                  border: `1px solid ${n.read ? "rgba(255,255,255,0.06)" : "rgba(61,191,176,0.2)"}`,
                  borderLeft: `4px solid ${vis.accent}`,
                  borderRadius: 12,
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                  touchAction: "manipulation",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    borderRadius: 10,
                    background: vis.sheetBg,
                    border: `1px solid ${vis.sheetBd}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                  }}
                >
                  {vis.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "1.05rem", fontFamily: "var(--font-display)", fontStyle: "italic", color: n.read ? "var(--muted)" : "var(--cream)" }}>
                    {n.tableName || "—"}
                  </div>
                  <div style={{ fontSize: "11px", letterSpacing: "0.06em", color: vis.accent, marginTop: 6, fontWeight: 600 }}>
                    {staffNotificationLabel(n.type)}
                  </div>
                  {n.message && n.type === "order" ? (
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.45, wordBreak: "break-word" }}>
                      {n.message}
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: 4 }}>
                      {n.message && n.message !== "Waiter Request" && n.message !== "Bill Request" ? n.message : ""}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "13px", color: "var(--gold)", fontFamily: "var(--font-display)" }}>{n.time?.toLocaleTimeString?.() ?? ""}</div>
                  {!n.read && <div style={{ fontSize: "9px", letterSpacing: "0.2em", color: "var(--gold)", marginTop: 6 }}>ახალი</div>}
                </div>
              </button>
              );
            })}
          </div>
        )}
      </div>

      {import.meta.env.VITE_DEPLOY_STAMP ? (
        <div style={{ padding: "8px 16px 16px", fontSize: "7px", color: "var(--muted)", opacity: 0.6 }}>build {String(import.meta.env.VITE_DEPLOY_STAMP)}</div>
      ) : null}
    </div>
  );
}

/* ─── Analytics ───────────────────────────────────────────────────────── */
function AdminAnalytics({ store }) {
  const { dishes, categories, analytics } = store;
  const top = [...dishes].sort((a,b)=>(analytics.views[b.id]||0)-(analytics.views[a.id]||0)).slice(0,6);
  const maxV = Math.max(...top.map(d=>analytics.views[d.id]||0),1);
  const catData = [...categories].sort((a,b)=>(a.order??0)-(b.order??0)).map(c=>({ ...c, views: dishes.filter(d=>d.categoryId===c.id).reduce((s,d)=>s+(analytics.views[d.id]||0),0) }));

  return (
    <div style={{ padding:"40px", color:"var(--cream)" }}>
      <PageHeader title="Insights" sub="Performance Analytics" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"32px" }}>
        <Stat icon="◈" label="Total Scans" value={analytics.scans} color="var(--gold)" />
        <Stat icon="◎" label="Total Views" value={Object.values(analytics.views).reduce((a,b)=>a+b,0)} color="#8b5cf6" />
        <Stat icon="◉" label="Available Dishes" value={dishes.filter(d=>d.available).length} color="#10b981" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"3fr 2fr", gap:"16px" }}>
        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"28px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"24px" }}>Most Viewed Dishes</div>
          {top.map((dish,i) => {
            const v = analytics.views[dish.id]||0;
            const pct = (v/maxV)*100;
            return (
              <div key={dish.id} style={{ marginBottom:"16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
                    <span style={{ fontSize:"9px", color:"var(--subtle)", width:"14px" }}>#{i+1}</span>
                    <span style={{ fontSize:"12px", color:"var(--cream)" }}>{dish.name.en}</span>
                  </div>
                  <span style={{ fontSize:"12px", fontFamily:"var(--font-display)", color:"var(--gold-light)" }}>{v}</span>
                </div>
                <div style={{ height:"2px", background:"rgba(255,255,255,0.05)" }}>
                  <div style={{ width:`${pct}%`, height:"100%", background:`linear-gradient(90deg,var(--gold),var(--amber))`, transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ background:"var(--charcoal)", border:"1px solid rgba(61,191,176,0.1)", padding:"28px" }}>
          <div style={{ fontSize:"8px", color:"var(--gold)", letterSpacing:"4px", textTransform:"uppercase", marginBottom:"24px" }}>Category Views</div>
          {catData.sort((a,b)=>b.views-a.views).map(cat => (
            <div key={cat.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"12px", color:"var(--gold)", opacity:0.6 }}>{cat.icon}</span>
                <span style={{ fontSize:"11px", color:"var(--cream)" }}>{cat.name.en}</span>
              </div>
              <span style={{ fontFamily:"var(--font-display)", fontSize:"18px", color:"var(--gold-light)" }}>{cat.views}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WELCOME (language gate)
═══════════════════════════════════════════════════════════════════════════ */
const WELCOME_STORAGE_KEY = "tiflisi_welcome_v1";

/** სტუმარი: არჩეული მაგიდა გადატვირთვის შემდეგ (როცა URL-ში ?table= არ ჩანს). */
const GUEST_TABLE_STORAGE_KEY = "tiflisi_guest_table_v1";

function readSavedGuestTableId() {
  try {
    const raw = sessionStorage.getItem(GUEST_TABLE_STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const trimmed = raw.trim();
    const n = Number(trimmed);
    if (Number.isFinite(n) && String(n) === trimmed) return n;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

function writeSavedGuestTableId(id) {
  if (id == null) return;
  try {
    sessionStorage.setItem(GUEST_TABLE_STORAGE_KEY, String(id));
  } catch {
    /* ignore */
  }
}

/** `location.pathname` (React Router, after basename) or full `window.location.pathname` (e.g. …/admin on GitHub Pages). */
function pathMatchesAdmin(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  return p === "/admin" || p.endsWith("/admin");
}

function pathMatchesWelcome(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  return p === "/welcome" || p.endsWith("/welcome");
}

/** მიმტანის პანელი — `/staff` (basename-ის შემდეგ, მაგ. `/QR/staff`). */
function pathMatchesStaff(pathname) {
  const p = (pathname || "/").replace(/\/+$/, "") || "/";
  return p === "/staff" || p.endsWith("/staff");
}

function readTableIdFromUrl(search) {
  try {
    const s = search ?? (typeof window !== "undefined" ? window.location.search : "");
    const q = new URLSearchParams(s).get("table");
    if (q == null || q === "") return null;
    const trimmed = q.trim();
    const n = Number(trimmed);
    if (Number.isFinite(n) && String(n) === trimmed) return n;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

function readSavedWelcomeLang() {
  try {
    const raw = sessionStorage.getItem(WELCOME_STORAGE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j?.lang && ["en", "ka", "ru"].includes(j.lang)) return j.lang;
  } catch {}
  return null;
}

function WelcomePreloader({ fading }) {
  return (
    <div
      aria-label="Loading welcome screen"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 12000,
        background:
          "radial-gradient(ellipse at 18% 20%, rgba(64, 224, 208, 0.12), transparent 42%), radial-gradient(ellipse at 82% 80%, rgba(201, 169, 98, 0.12), transparent 44%), linear-gradient(180deg, #020405 0%, #04090b 45%, #020506 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.9s ease",
        pointerEvents: fading ? "none" : "auto",
        overflow: "hidden",
      }}
    >
      <style>{`
        .rt-preloader-inner { position: relative; z-index: 2; width: min(90vw, 920px); padding: 18px 14px; }
        .rt-preloader-svg { width: 100%; height: auto; }
        .rt-preloader-title-base { fill: rgba(64, 224, 208, 0.06); stroke: none; }
        .rt-preloader-title {
          fill: none; stroke: #40e0d0; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 1620; stroke-dashoffset: 1620;
          filter: drop-shadow(0 0 6px rgba(64, 224, 208, 0.45)) drop-shadow(0 0 18px rgba(64, 224, 208, 0.25));
          animation: rtPreloaderStrokeDraw 2.9s cubic-bezier(0.2, 0.75, 0.2, 1) forwards;
        }
        .rt-preloader-title-glow {
          fill: none; stroke: rgba(64, 224, 208, 0.38); stroke-width: 0.95; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 1620; stroke-dashoffset: 1620; filter: blur(0.25px);
          animation: rtPreloaderStrokeDraw 2.9s cubic-bezier(0.2, 0.75, 0.2, 1) forwards;
        }
        .rt-preloader-sheen {
          fill: none; stroke: rgba(255, 255, 255, 0.4); stroke-width: 0.7;
          stroke-dasharray: 120 1500; stroke-dashoffset: 0; opacity: 0;
          animation: rtPreloaderSheen 2.6s ease 1.4s forwards;
        }
        @keyframes rtPreloaderStrokeDraw { to { stroke-dashoffset: 0; } }
        @keyframes rtPreloaderSheen {
          0% { opacity: 0; stroke-dashoffset: 420; }
          20% { opacity: 0.95; }
          100% { opacity: 0; stroke-dashoffset: -1320; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rt-preloader-title, .rt-preloader-title-glow, .rt-preloader-sheen { animation: none; stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>
      <div className="rt-preloader-inner">
        <svg className="rt-preloader-svg" viewBox="0 0 960 240" role="img" aria-label="Restaurant Tiflisi">
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="rt-preloader-title-base"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "126px", fontStyle: "italic", letterSpacing: "0.03em" }}
          >
            Restaurant Tiflisi
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="rt-preloader-title-glow"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "126px", fontStyle: "italic", letterSpacing: "0.03em" }}
          >
            Restaurant Tiflisi
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="rt-preloader-title"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "126px", fontStyle: "italic", letterSpacing: "0.03em" }}
          >
            Restaurant Tiflisi
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            dominantBaseline="middle"
            className="rt-preloader-sheen"
            style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "126px", fontStyle: "italic", letterSpacing: "0.03em" }}
          >
            Restaurant Tiflisi
          </text>
        </svg>
      </div>
    </div>
  );
}

function WelcomeScreen({ onChooseLang, tableId, tables, onTableChange }) {
  const [finePointer, setFinePointer] = useState(false);
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const [heroUrl, setHeroUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("./hero picture.png")
      .then((m) => {
        if (!cancelled && m?.default) setHeroUrl(m.default);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const mq = window.matchMedia("(pointer: fine)");
      const sync = () => setFinePointer(!!mq.matches);
      sync();
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    } catch {
      setFinePointer(false);
    }
  }, []);

  useEffect(() => {
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      reduced = false;
    }
    if (reduced || !finePointer) return undefined;

    const onMove = (e) => {
      const cx = window.innerWidth * 0.5;
      const cy = window.innerHeight * 0.5;
      const dx = (e.clientX - cx) / Math.max(cx, 1);
      const dy = (e.clientY - cy) / Math.max(cy, 1);
      setShift({ x: dx * 14, y: dy * 11 });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [finePointer]);

  const imgTransform = finePointer ? `scale(1.1) translate3d(${shift.x}px, ${shift.y}px, 0)` : undefined;

  const tableList = Array.isArray(tables) ? tables : [];
  const showTable = tableList.length > 0;

  return (
    <div
      aria-labelledby="welcome-title"
      className={`welcome-hero-root${finePointer ? " welcome-hero--parallax" : ""}`}
    >
      <div className="noise" aria-hidden="true" />
      <div className="welcome-hero-media-wrap" aria-hidden="true">
        <img
          className="welcome-hero-img"
          src={heroUrl || undefined}
          srcSet={heroUrl ? `${heroUrl} 1920w` : undefined}
          sizes="100vw"
          width={1920}
          height={1280}
          alt=""
          decoding="async"
          loading="eager"
          fetchPriority="high"
          style={imgTransform ? { transform: imgTransform } : undefined}
        />
      </div>
      <div className="welcome-hero-dark" aria-hidden="true" />
      <div className="welcome-hero-vignette" aria-hidden="true" />

      <div className="welcome-hero-inner">
        <header>
          <p className="welcome-hero-eyebrow">Tiflisi Georgian Restaurant</p>
          <h1 id="welcome-title" className="welcome-hero-title">
            Welcome to Tiflisi
            <span>Digital menu</span>
          </h1>
          <p className="welcome-hero-sub">
            Scan the QR code to open the menu, choose your language, and order directly from your table.
          </p>
          <p className="welcome-hero-ka" lang="ka">
            კეთილი იყოს თქვენი მობრძანება · Добро пожаловать
          </p>
        </header>

        <div className="welcome-hero-social">
          <SocialTopStrip />
        </div>

        {showTable && typeof onTableChange === "function" && (
          <div className="welcome-hero-table">
            <label htmlFor="welcome-table-select">Table · მაგიდა</label>
            <div className="welcome-hero-table-wrap">
              <select
                id="welcome-table-select"
                value={String(tableId)}
                onChange={(e) => {
                  const raw = e.target.value;
                  const id = /^\d+$/.test(raw) ? Number(raw) : raw;
                  onTableChange(id);
                }}
              >
                {tableList.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                    {t.zone ? ` — ${t.zone}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="welcome-hero-divider" aria-hidden="true">
          <i />
          <span>ენა · Language</span>
          <i />
        </div>

        <div className="welcome-hero-actions">
          <button type="button" className="welcome-btn-primary" onClick={() => onChooseLang("ka")}>
            ქართული
            <small>მენიუს გახსნა</small>
          </button>
          <button type="button" className="welcome-btn-ghost" onClick={() => onChooseLang("en")}>
            English
          </button>
          <button type="button" className="welcome-btn-ghost" onClick={() => onChooseLang("ru")}>
            Русский
          </button>
        </div>

        <p className="welcome-hero-hint">აირჩიეთ ენა · Choose language · Выберите язык</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const store = useStore();
  const location = useLocation();
  const go = useNavigate();

  const isAdminRoute = useMemo(() => pathMatchesAdmin(location.pathname), [location.pathname]);
  const isStaffRoute = useMemo(() => pathMatchesStaff(location.pathname), [location.pathname]);
  const isWelcomeRoute = useMemo(() => pathMatchesWelcome(location.pathname), [location.pathname]);

  const [enteredMenu, setEnteredMenu] = useState(() => {
    if (readSavedWelcomeLang() !== null) return true;
    if (typeof window === "undefined") return false;
    const p = window.location.pathname;
    return pathMatchesAdmin(p) || pathMatchesStaff(p);
  });
  const [lang, setLang] = useState(() => readSavedWelcomeLang() ?? "ka");
  const [tableId, setTableId] = useState(() => readTableIdFromUrl() ?? readSavedGuestTableId() ?? 1);
  const [adminAuth, setAdminAuth] = useState(false);
  const [staffAuth, setStaffAuth] = useState(false);
  const [showWelcomePreloader, setShowWelcomePreloader] = useState(true);
  const [fadeWelcomePreloader, setFadeWelcomePreloader] = useState(false);
  const preloaderPlayedRef = useRef(false);

  useLayoutEffect(() => {
    if (isAdminRoute || isStaffRoute) setEnteredMenu(true);
  }, [isAdminRoute, isStaffRoute]);

  useEffect(() => {
    if (isAdminRoute || isStaffRoute || enteredMenu || isWelcomeRoute) return;
    go({ pathname: "/welcome", search: location.search }, { replace: true });
  }, [go, isAdminRoute, isStaffRoute, enteredMenu, isWelcomeRoute, location.search]);

  const shouldShowWelcome = !isAdminRoute && !isStaffRoute && (isWelcomeRoute || !enteredMenu);

  useEffect(() => {
    if (preloaderPlayedRef.current || isAdminRoute || isStaffRoute) {
      setShowWelcomePreloader(false);
      setFadeWelcomePreloader(false);
      return;
    }
    preloaderPlayedRef.current = true;
    setShowWelcomePreloader(true);
    setFadeWelcomePreloader(false);
    const fadeTimer = window.setTimeout(() => setFadeWelcomePreloader(true), 2400);
    const hideTimer = window.setTimeout(() => setShowWelcomePreloader(false), 3100);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [isAdminRoute, isStaffRoute]);

  const syncTableParams = useCallback(
    (id) => {
      setTableId(id);
      try {
        const sp = new URLSearchParams(location.search);
        sp.set("table", String(id));
        const next = sp.toString();
        go({ search: next ? `?${next}` : "" }, { replace: true });
      } catch {
        /* ignore */
      }
    },
    [go, location.search]
  );

  useEffect(() => {
    if (store.tables.length === 0) return;
    setTableId((prev) => {
      if (store.tables.some((t) => String(t.id) === String(prev))) return prev;
      const u = readTableIdFromUrl(location.search);
      if (u != null && store.tables.some((t) => String(t.id) === String(u))) return u;
      return store.tables[0].id;
    });
  }, [store.tables, location.search]);

  useEffect(() => {
    const t = readTableIdFromUrl(location.search);
    if (t == null) return;
    if (store.tables.length > 0 && !store.tables.some((x) => String(x.id) === String(t))) return;
    setTableId(t);
  }, [location.search, store.tables]);

  /** მაგიდის ნებისმიერი ცვლილება — session, რომ გადატვირთვაზე არ დაიკარგოს. */
  useEffect(() => {
    if (tableId == null) return;
    writeSavedGuestTableId(tableId);
  }, [tableId]);

  useEffect(() => {
    document.documentElement.lang = lang === "ka" ? "ka" : lang === "ru" ? "ru" : "en";
  }, [lang]);

  const enterWithLang = useCallback((l) => {
    setLang(l);
    try {
      sessionStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({ lang: l }));
    } catch {}
    setEnteredMenu(true);
    try {
      const sp = new URLSearchParams(location.search);
      sp.set("table", String(tableId));
      const q = sp.toString();
      go({ pathname: "/", search: q ? `?${q}` : "" }, { replace: true });
    } catch {
      go({ pathname: "/", search: location.search }, { replace: true });
    }
  }, [go, location.search, tableId]);

  return (
    <div>
      {!isAdminRoute && !isStaffRoute && showWelcomePreloader && (
        <>
          <WelcomePreloader fading={fadeWelcomePreloader} />
        </>
      )}
      {shouldShowWelcome && !showWelcomePreloader && (
        <WelcomeScreen
          onChooseLang={enterWithLang}
          tableId={tableId}
          tables={store.tables}
          onTableChange={syncTableParams}
        />
      )}

      {enteredMenu && !isAdminRoute && !isStaffRoute && !isWelcomeRoute && (
        <CustomerMenu tableId={tableId} store={store} lang={lang} />
      )}
      {enteredMenu && isAdminRoute && !adminAuth && (
        <AdminLogin onLogin={() => { setAdminAuth(true); }} />
      )}
      {enteredMenu && isAdminRoute && adminAuth && (
        <AdminPanel store={store} onLogout={() => { setAdminAuth(false); go("/"); }} />
      )}
      {enteredMenu && isStaffRoute && !staffAuth && (
        <StaffLogin
          onLogin={() => {
            setStaffAuth(true);
          }}
        />
      )}
      {enteredMenu && isStaffRoute && staffAuth && (
        <StaffAlertsScreen
          store={store}
          onLogout={() => {
            setStaffAuth(false);
            go("/");
          }}
        />
      )}
    </div>
  );
}
