import { supabase } from "./supabaseClient.js";

const TABLE = "service_alerts";

/** DB row ↔ მენიუში გამოყენებული notification ობიექტი. */
export function rowToNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    tableId: row.table_id,
    tableName: row.table_name ?? "",
    tableZone: row.table_zone ?? "",
    message: row.message ?? "",
    time: row.created_at ? new Date(row.created_at) : new Date(),
    read: !!row.read,
  };
}

export function isLikelyUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id));
}

/**
 * სტუმარი → Supabase (მიმტანი/ადმინი სხვა მოწყობილობიდან იღებს Realtime-ით).
 * @param {{ type: string, tableId: *, tableName?: string, tableZone?: string, message?: string }} note
 */
export async function insertServiceAlert(note) {
  if (!supabase) throw new Error("Supabase client not configured");
  const payload = {
    type: note.type,
    table_id: note.tableId != null ? String(note.tableId) : "",
    table_name: note.tableName != null ? String(note.tableName) : "",
    table_zone: note.tableZone != null ? String(note.tableZone) : "",
    message: note.message != null ? String(note.message) : "",
    read: false,
  };
  const { data, error } = await supabase.from(TABLE).insert(payload).select("*").single();
  if (error) throw error;
  return rowToNotification(data);
}

export async function fetchServiceAlerts(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(rowToNotification).filter(Boolean);
}

/** მასიური წაშლა / წაკითხული — `setNotifications`-ის შემდეგი სინქი. */
export async function syncNotificationsToSupabase(prev, next) {
  if (!supabase) return;
  const prevMap = new Map(prev.map((n) => [String(n.id), n]));
  const nextMap = new Map(next.map((n) => [String(n.id), n]));

  for (const [id] of prevMap) {
    if (!nextMap.has(id) && isLikelyUuid(id)) {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) console.warn("[service_alerts] delete", id, error.message);
    }
  }

  for (const [id, nNew] of nextMap) {
    const nOld = prevMap.get(id);
    if (!nOld || !isLikelyUuid(id)) continue;
    if (nOld.read !== nNew.read) {
      const { error } = await supabase.from(TABLE).update({ read: !!nNew.read }).eq("id", id);
      if (error) console.warn("[service_alerts] update read", id, error.message);
    }
  }
}
