import { createClient } from "@supabase/supabase-js";

/**
 * Vite-ში (ამ პროექტში) გამოიყენე `import.meta.env` + npm `@supabase/supabase-js` — არა CDN `import`,
 * რადგან bundler-ი უკეთესად ამუშავებს დამოკიდებულებას და production build-ს.
 *
 * ლოკალურად: პროექტის ფესვში `.env.local` (gitignored):
 *   VITE_SUPABASE_URL=https://xxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY=your_anon_key
 *
 * GitHub Pages: იგივე სახელები Repository Secrets-ში → Actions workflow `npm run build`-ს აძლევს env-ს.
 *
 * Security: use only the **anon** key in the browser. Never commit or expose the **service_role** key
 * in client-side code (it bypasses RLS). RLS policies on `menu`, `menu_categories`, `seating`, etc. protect data.
 *
 * თუ მხოლოდ სტატიკური HTML გაქვს (Vite არა), ცალკე სკრიპტში შეგიძლია:
 *   import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
 *   export const supabase = createClient(url, key); // ან url/key პირდაპირ სტრინგად (არ ატვირთო საჯარო რეპოში საიდუმლო გასაღებით)
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  typeof supabaseUrl === "string" &&
  supabaseUrl.length > 0 &&
  typeof supabaseAnonKey === "string" &&
  supabaseAnonKey.length > 0
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseConfigured() {
  return supabase != null;
}
