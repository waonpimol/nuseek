import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  title: string;
  description?: string;
  // ปุ่ม "ลองใหม่" หรือลิงก์กลับ (ไม่ใส่ก็ได้)
  children?: ReactNode;
  className?: string;
}

// สถานะ "เกิดข้อผิดพลาด" ที่ใช้ร่วมกันทั้งแอป หน้าตาคู่กับ EmptyState (ไอคอนในวงกลม + หัวข้อ + คำอธิบาย + ปุ่ม)
// ต่างกันที่สีไอคอนเป็นโทนแดงอ่อน เพื่อแยกว่า "มีปัญหา" ไม่ใช่ "ยังไม่มีข้อมูล"
export default function ErrorState({ title, description, children, className = "" }: ErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center text-center py-12 sm:py-16 px-4 ${className}`}>
      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
        <AlertTriangle size={28} strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-sm sm:text-base font-semibold text-gray-800">{title}</h3>
      {description && (
        <p className="mt-1 text-xs sm:text-sm text-gray-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">{children}</div>}
    </div>
  );
}