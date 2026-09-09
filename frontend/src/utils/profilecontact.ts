import { supabase } from "../services/supabaseClient";

// เช็คว่าผู้ใช้มีข้อมูลติดต่ออย่างน้อย 1 ช่องทางในโปรไฟล์แล้วหรือยัง
// (เบอร์โทร, Line, Facebook, Instagram) — ใช้บังคับก่อนให้ลงประกาศแจ้งของหาย/พบของ
// เพราะถ้าไม่มีเลยสักช่องทาง ต่อให้แมทช์กันได้ อีกฝั่งก็ติดต่อกลับไม่ได้อยู่ดี
export async function hasContactInfo(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("phone_number, line_id, facebook_url, instagram_username")
    .eq("id", userId)
    .single();

  if (error || !data) return false;

  return !!(
    data.phone_number ||
    data.line_id ||
    data.facebook_url ||
    data.instagram_username
  );
}