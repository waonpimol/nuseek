import { Link } from "react-router-dom";
import { PackageSearch, Home } from "lucide-react";

// หน้าที่แสดงเมื่อพิมพ์ URL ที่ไม่มีในระบบ (แทนหน้าขาวเปล่า)
export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-10 font-kanit">
      <div className="w-full max-w-sm text-center">
        <PackageSearch className="mx-auto w-16 h-16 sm:w-20 sm:h-20 text-gray-700 stroke-[1.5]" />

        <p className="mt-4 text-5xl sm:text-6xl font-bold text-[#FF6B00]">404</p>
        <h1 className="mt-2 text-lg sm:text-xl font-semibold text-gray-900">ไม่พบหน้าที่คุณต้องการ</h1>
        <p className="mt-1.5 text-xs sm:text-sm text-gray-500 leading-relaxed">
          หน้านี้อาจถูกย้ายหรือพิมพ์ที่อยู่ผิด ลองกลับไปหน้าแรกแล้วเริ่มใหม่อีกครั้ง
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white px-6 py-2 sm:py-2.5 text-sm rounded-xl font-semibold transition"
        >
          <Home size={16} />
          กลับหน้าแรก
        </Link>
      </div>
    </div>
  );
}