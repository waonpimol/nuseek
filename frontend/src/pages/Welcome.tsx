import { Link } from "react-router-dom";
import { PackageSearch, UserPlus, ArrowRight, Backpack, Wallet, Smartphone, KeyRound } from "lucide-react";

export default function Welcome() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-6 py-12 font-kanit relative overflow-hidden">

      {/* องค์ประกอบตกแต่งพื้นหลัง — จุดกริด, เส้นเฉียง, วงแหวน
          มือถือ: กระจายสลับซ้าย-ขวา ระยะห่างจากขอบไม่เท่ากัน ใช้พื้นที่ว่างข้างโลโก้/ชื่อ และแถบบน-ล่าง (เลี่ยงข้อความกลางจอ)
          จอใหญ่ (sm/lg): กลับไปใช้ตำแหน่งเดิม — ที่ย้ายข้างจากซ้ายเป็นขวาต้องมี *-auto ล้างค่าฝั่งเดิม */}
      <div className="grid absolute top-7 right-[12%] sm:top-16 sm:right-16 grid-cols-3 gap-1.5 sm:gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]/50" />
        ))}
      </div>
      <div className="absolute top-14 left-[22%] sm:top-28 sm:left-28 w-6 sm:w-8 h-[2px] bg-gray-300 rotate-45" />
      <div className="absolute bottom-36 right-[8%] sm:bottom-36 sm:right-28 w-8 sm:w-10 h-[2px] bg-[#FF6B00]/60 rotate-45" />
      <div className="absolute bottom-20 left-[14%] sm:bottom-24 sm:left-20 w-5 sm:w-6 h-[2px] bg-gray-300 rotate-45" />
      <div className="absolute top-5 left-[8%] sm:top-1/3 sm:left-auto sm:right-12 w-7 h-7 sm:w-10 sm:h-10 rounded-full border-2 border-[#FF6B00]/30" />

      {/* ชุดกลางจอ (ซ้าย-ขวาของการ์ด) — มือถือแทรกตามช่องว่างข้างชื่อ/ไอคอน / จอกว้างกันพื้นที่ว่างโล่ง */}
      <div className="absolute top-[34%] left-[5%] lg:top-1/2 lg:left-[12%] -translate-y-1/2 w-4 h-4 lg:w-6 lg:h-6 rounded-full border-2 border-gray-200" />
      <div className="grid absolute top-[48%] left-[9%] lg:top-[38%] lg:left-[18%] grid-cols-2 gap-1.5 lg:gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        ))}
      </div>
      <div className="absolute top-[57%] right-[16%] lg:top-[60%] lg:right-[18%] w-5 lg:w-7 h-[2px] bg-[#FF6B00]/50 rotate-45" />
      <div className="absolute top-[30%] right-[4%] lg:top-[40%] lg:right-[14%] w-8 h-8 lg:w-12 lg:h-12 rounded-full border-2 border-[#FF6B00]/20" />
      <div className="absolute bottom-[7%] right-[20%] lg:bottom-[15%] lg:right-auto lg:left-[16%] w-4 h-4 lg:w-5 lg:h-5 rounded-full bg-[#FF6B00]/10" />

      <div className="w-full max-w-sm sm:max-w-md text-center relative z-10">

        {/* โลโก้ */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-[#FF6B00] rounded-3xl flex items-center justify-center shadow-xl shadow-[#FF6B00]/30">
            <PackageSearch className="text-white w-10 h-10" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mt-6">
          <span className="text-gray-900">NU</span>
          <span className="text-[#FF6B00]">Seek</span>
        </h1>

        <p className="text-gray-600 mt-3 text-sm sm:text-base leading-relaxed">
          ระบบตามหาของหายในมหาวิทยาลัย<br />
          ด้วย <span className="text-[#FF6B00] font-semibold">AI Agent</span>
        </p>
        <p className="text-gray-400 mt-2 text-xs sm:text-sm">
          ช่วยให้การตามหาสิ่งของเป็นเรื่องง่าย และมีประสิทธิภาพมากขึ้น
        </p>

        {/* กลุ่มไอคอนของจริง (กระเป๋า/กระเป๋าสตางค์/มือถือ/กุญแจ) บนฐานเงานุ่มๆ */}
        <div className="relative mt-8 mb-8 h-28 sm:h-32 flex items-center justify-center">
          <div className="relative flex items-end gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-2xl flex items-center justify-center shadow-md -rotate-6">
              <Backpack className="text-gray-600 w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center shadow-md rotate-3 -mb-2">
              <Wallet className="text-[#FF6B00] w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-800 rounded-2xl flex items-center justify-center shadow-md -rotate-3">
              <Smartphone className="text-white w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#FF6B00]/10 rounded-2xl flex items-center justify-center shadow-md rotate-6 -mb-1">
              <KeyRound className="text-[#FF6B00] w-6 h-6 sm:w-7 sm:h-7" />
            </div>
          </div>
        </div>

        {/* ปุ่มเลือก */}
        <div className="flex flex-col gap-3">
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-3.5 rounded-2xl font-semibold shadow-md shadow-[#FF6B00]/25 transition"
          >
            เข้าสู่ระบบ
            <ArrowRight size={18} />
          </Link>

          <Link
            to="/signup"
            className="flex items-center justify-center gap-2 bg-white hover:bg-[#FF6B00]/5 border-2 border-[#FF6B00]/30 text-[#FF6B00] py-3.5 rounded-2xl font-semibold transition"
          >
            <UserPlus size={18} />
            สมัครสมาชิก
          </Link>
        </div>
      </div>
    </div>
  );
}