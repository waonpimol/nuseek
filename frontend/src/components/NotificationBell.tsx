import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { getNotificationTitle } from "../utils/notification";
import { formatRelativeTime } from "../utils/format";
import NotificationIcon from "./NotificationIcon";

// กระดิ่งแจ้งเตือนบน navbar + กล่องรายการแจ้งเตือน ใช้ร่วมกันทุกหน้า
// อยากแก้หน้าตา/ข้อความ/การทำงานของแจ้งเตือน แก้ที่ไฟล์นี้ (กับ NotificationIcon, utils/notification) ที่เดียว
// ดึงข้อมูลเองผ่าน useNotifications ไม่ต้องส่ง props
export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();
  const [showNoti, setShowNoti] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState<number | null>(null);

  // คำนวณตำแหน่งลูกศรให้ชี้ตรงกระดิ่งเสมอ ไม่ว่ากล่องแจ้งเตือนจะอยู่ตำแหน่งไหน
  // (มือถือ: กล่องอยู่กึ่งกลางจอ / จอใหญ่: กล่องยึดกับกระดิ่ง ตำแหน่งไม่เท่ากัน คำนวณสดเลยแม่นกว่า)
  useEffect(() => {
    if (showNoti && bellButtonRef.current && notifDropdownRef.current) {
      const bellRect = bellButtonRef.current.getBoundingClientRect();
      const dropdownRect = notifDropdownRef.current.getBoundingClientRect();
      const bellCenterX = bellRect.left + bellRect.width / 2;
      let left = bellCenterX - dropdownRect.left - 8;
      left = Math.max(12, Math.min(left, dropdownRect.width - 28));
      setArrowLeft(left);
    }
  }, [showNoti]);

  return (
    <div className="relative">
      <button
        ref={bellButtonRef} onClick={() => setShowNoti(!showNoti)}
        className={`p-2 rounded-full transition relative ${showNoti ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-500 hover:bg-gray-100"
          }`}
      >
        <Bell />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
        )}
      </button>
    
      {showNoti && (
        <div ref={notifDropdownRef} className="fixed sm:absolute top-16 sm:top-12 left-1/2 -translate-x-1/2 w-[80vw] max-w-[300px] sm:translate-x-0 sm:left-auto sm:-right-16 sm:w-[92vw] sm:max-w-[360px] bg-white rounded-2xl border border-gray-200 shadow-xl z-50 font-kanit">
          <div className="absolute -top-2 w-4 h-4 bg-white border-t border-l border-gray-200 rotate-45 z-10" style={{ left: arrowLeft !== null ? `${arrowLeft}px` : undefined, right: arrowLeft !== null ? undefined : '73px' }}></div>
          <div className="relative z-20 bg-white rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center px-3 py-2.5 sm:px-5 sm:py-3.5 border-b border-gray-100">
              <span className="font-bold text-gray-800 text-xs sm:text-sm">การแจ้งเตือน</span>
              <button onClick={markAllRead} className="text-[10px] sm:text-xs font-semibold text-orange-500 hover:underline">อ่านทั้งหมด</button>
            </div>
            <div className="max-h-[260px] sm:max-h-[320px] overflow-y-auto divide-y divide-gray-100">
              {notifications.length === 0 && (
                <div className="p-6 text-center text-xs text-gray-400">ยังไม่มีแจ้งเตือน</div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    markOneRead(n.id);
                    const targetItemId = n.matched_item_id || n.item_id; if (targetItemId) navigate(`/postdetail/${targetItemId}`);
                  }}
                  className={`flex gap-2 p-2.5 sm:gap-3 sm:p-4 hover:bg-gray-50 transition cursor-pointer text-left ${n.is_read ? "" : "bg-orange-50/40"}`}
                >
                  <NotificationIcon n={n} />
                  <div className="flex flex-col gap-0.5 flex-1">
                    <p className="text-xs sm:text-sm font-bold text-gray-800 leading-snug">{getNotificationTitle(n)}</p>
                    <p className="text-[10px] sm:text-[11px] text-gray-600 leading-normal">{n.message}</p>
                    <span className="text-[9px] sm:text-[10px] text-gray-400">{formatRelativeTime(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
