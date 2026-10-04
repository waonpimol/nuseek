import { useEffect, useState } from "react";
import Spinner from "./Spinner";

interface LoadingOverlayProps {
  open: boolean;
  // ข้อความที่จะไล่เปลี่ยนไปทีละอันระหว่างรอ (อันสุดท้ายจะค้างไว้จนกว่าจะเสร็จ)
  messages: string[];
  intervalMs?: number;
}

// Overlay เต็มจอสำหรับงานที่รอนาน (ส่งประกาศ / ค้นหาด้วยรูป ที่ต้องรอ AI)
// หมายเหตุ: ข้อความที่เปลี่ยนเป็นการเดินตามเวลา (timer) ไม่ได้อ่านความคืบหน้าจริงจาก backend
// เพราะ endpoint ตอบกลับครั้งเดียวตอนจบ ไม่ได้ stream สถานะระหว่างทาง
export default function LoadingOverlay({
  open,
  messages,
  intervalMs = 2500,
}: LoadingOverlayProps) {
  const [index, setIndex] = useState(0);

  // ไล่เปลี่ยนข้อความทีละขั้น แล้วหยุดที่อันสุดท้าย / รีเซ็ตกลับต้นเมื่อปิด
  useEffect(() => {
    if (!open) {
      setIndex(0);
      return;
    }
    if (messages.length <= 1) return;

    const timer = setInterval(() => {
      setIndex((i) => Math.min(i + 1, messages.length - 1));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [open, messages.length, intervalMs]);

  // ล็อกการเลื่อนหน้าด้านหลังระหว่างที่ overlay เปิดอยู่
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  const safeIndex = Math.min(index, Math.max(messages.length - 1, 0));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      style={{ zIndex: 900 }}
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="bg-white rounded-2xl shadow-xl px-8 py-7 flex flex-col items-center gap-4 text-center max-w-[85vw]">
        <Spinner size={40} className="text-orange-500" />
        <p className="text-gray-800 font-semibold text-sm sm:text-base">
          {messages[safeIndex] ?? "กำลังดำเนินการ..."}
        </p>
        <p className="text-gray-400 text-xs">อาจใช้เวลาสักครู่ กรุณาอย่าปิดหน้านี้</p>
      </div>
    </div>
  );
}
