import type { AppNotification } from "../hooks/useNotifications";

// หัวข้อของแจ้งเตือน (บรรทัดตัวหนาเหนือข้อความ)
// - แจ้งเตือนใหม่: backend เก็บ title มาให้แล้ว
// - แจ้งเตือนเก่าที่ยังไม่มี title: เดาจากข้อความ (คำขึ้นต้น/วลีเด่นของแต่ละแบบ) ถ้าเดาไม่ได้ใช้ "การแจ้งเตือน"
export function getNotificationTitle(n: Pick<AppNotification, "title" | "message">): string {
  if (n.title) return n.title;
  const m = n.message || "";

  if (m.startsWith("พบสิ่งของที่ตรงกับประกาศ")) return "พบสิ่งของที่ตรงกับของหายของคุณ";
  if (m.startsWith("มีคนกำลังตามหาของที่ตรงกับ")) return "มีคนกำลังตามหาของที่คุณพบ";
  if (m.startsWith("เจ้าของของหายยืนยันแล้ว")) return "เจ้าของยืนยันว่าเป็นของเขา";
  if (m.includes("แจ้งว่าเจอ")) return "มีคนแจ้งว่าเจอของของคุณ";
  if (m.includes("น่าจะเป็นของเขา")) return "มีคนแจ้งว่าน่าจะเป็นของเขา";
  if (m.startsWith("อีกฝั่งยืนยันแล้ว")) return "ปิดเคสเรียบร้อยแล้ว";
  if (m.startsWith("ปิดเคสให้ประกาศ")) return "ปิดประกาศของคุณให้แล้ว";
  if (m.includes("ที่เคยแมทช์กับ")) return "ประกาศที่จับคู่กับคุณถูกลบแล้ว";
  if (m.includes("ถูกเจ้าของลบแล้ว")) return "ประกาศที่คุณแจ้งถูกลบแล้ว";
  return "การแจ้งเตือน";
}

export type NotificationKind = "match" | "confirmed" | "claim" | "done" | "deleted" | "other";

// ชนิดของแจ้งเตือน ใช้เลือกไอคอน/สี (ตัดสินจากหัวข้อ จึงใช้ได้ทั้งแจ้งเตือนใหม่และแจ้งเตือนเก่า)
export function getNotificationKind(n: Pick<AppNotification, "title" | "message">): NotificationKind {
  switch (getNotificationTitle(n)) {
    case "พบสิ่งของที่ตรงกับของหายของคุณ":
    case "มีคนกำลังตามหาของที่คุณพบ":
      return "match";
    case "เจ้าของยืนยันว่าเป็นของเขา":
      return "confirmed";
    case "มีคนแจ้งว่าเจอของของคุณ":
    case "มีคนแจ้งว่าน่าจะเป็นของเขา":
      return "claim";
    case "ปิดเคสเรียบร้อยแล้ว":
    case "ปิดประกาศของคุณให้แล้ว":
      return "done";
    case "ประกาศที่จับคู่กับคุณถูกลบแล้ว":
    case "ประกาศที่คุณแจ้งถูกลบแล้ว":
      return "deleted";
    default:
      return "other";
  }
}