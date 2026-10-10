import { Sparkles, UserCheck, CheckCircle2, PackageCheck, Trash2, Bell } from "lucide-react";
import { getNotificationKind, type NotificationKind } from "../utils/notification";
import type { AppNotification } from "../hooks/useNotifications";

// ไอคอนในวงกลมสีหน้ารายการแจ้งเตือน: แต่ละชนิดมีไอคอน/สีต่างกัน เห็นปุ๊บรู้ว่าเรื่องอะไร
const STYLE: Record<NotificationKind, { Icon: typeof Bell; box: string }> = {
  match: { Icon: Sparkles, box: "bg-orange-50 text-orange-500" },      // AI จับคู่เจอ
  confirmed: { Icon: CheckCircle2, box: "bg-green-50 text-green-600" }, // เจ้าของยืนยันแล้ว
  claim: { Icon: UserCheck, box: "bg-sky-50 text-sky-600" },           // มีคนแจ้ง/อ้างสิทธิ์
  done: { Icon: PackageCheck, box: "bg-green-50 text-green-600" },     // ปิดเคสแล้ว
  deleted: { Icon: Trash2, box: "bg-rose-50 text-rose-500" },          // ประกาศถูกลบ
  other: { Icon: Bell, box: "bg-gray-100 text-gray-500" },
};

export default function NotificationIcon({ n }: { n: Pick<AppNotification, "title" | "message"> }) {
  const { Icon, box } = STYLE[getNotificationKind(n)];
  return (
    <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${box}`}>
      <Icon size={15} />
    </div>
  );
}
