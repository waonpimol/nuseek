import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  confirmMatch,
} from "../services/api";

export interface AppNotification {
  id: string;
  user_id: string;
  item_id: string | null;
  matched_item_id: string | null;
  match_id: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Hook กลางไว้ใช้กับกระดิ่งแจ้งเตือนบน navbar ทุกหน้า
// ดึงแจ้งเตือนจริงจาก backend ของ user ที่ login อยู่ตอนนั้น
export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    try {
      const data = await getNotifications(user.id);
      setNotifications(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsRead(user.id);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const confirm = useCallback(async (matchId: string) => {
    await confirmMatch(matchId);
    await refresh(); // โหลดแจ้งเตือนใหม่ (ข้อความ "ยืนยันเรียบร้อย" จะมาแทนที่)
  }, [refresh]);

  return { notifications, loading, unreadCount, refresh, markAllRead, markOneRead, confirm };
}