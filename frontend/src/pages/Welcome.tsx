import { Link } from "react-router-dom";
import { LogIn, UserPlus, Package } from "lucide-react";

export default function Welcome() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-10 font-kanit">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 text-center">

        {/* โลโก้ */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center">
            <Package className="text-white w-8 h-8" />
          </div>
        </div>

        <h1 className="text-2xl font-bold mt-5">
          <span className="text-orange-500">N</span>
          <span className="text-gray-500">U</span>
          <span className="text-black">Seek</span>
        </h1>
        <p className="text-gray-500 mt-2 text-sm">
          ระบบตามหาของหายในมหาวิทยาลัยนเรศวรด้วย AI Agent
        </p>
        <p className="text-gray-400 mt-1 text-xs">
          เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มใช้งาน
        </p>

        {/* ปุ่มเลือก */}
        <div className="flex flex-col gap-3 mt-8">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3.5 rounded-xl font-semibold shadow-sm transition"
          >
            <LogIn size={18} />
            เข้าสู่ระบบ
          </Link>

          <Link
            to="/signup"
            className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold shadow-sm transition"
          >
            <UserPlus size={18} />
            สมัครสมาชิก
          </Link>
        </div>

      </div>
    </div>
  );
}