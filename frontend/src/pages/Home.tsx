import { Link } from 'react-router-dom';
import {
  Home,
  Image,
  User,
  Search,
  PackageSearch,
  FileText,
  Menu,
  X
} from "lucide-react";
import { useState } from 'react';
import NotificationBell from '../components/NotificationBell';

export default function HomePage() {


  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-cream antialiased">

      {/* ================= Navbar ================= */}

      <nav className="bg-white shadow-sm border-b border-gray-300">
        <div className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between px-4 md:px-8">

          <div className="flex items-center gap-3">

            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="text-orange-500">N</span>
              <span className="text-gray-500">U</span>
              <span className="text-black">Seek</span>
            </h1>
          </div>

          {/* Menu (desktop) */}

          <div className="hidden md:flex items-center gap-8 text-gray-700">

            <Link to="/" className="flex items-center gap-2 text-orange-500">
              <Home size={20} />
              หน้าแรก
            </Link>

            <Link to="/searchbyimage" className="flex items-center gap-2 hover:text-orange-500">
              <Image size={20} />
              ค้นหาจากรูป
            </Link>

            <Link to="/allposts" className="flex items-center gap-2 hover:text-orange-500">
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>

          </div>

          {/* Right */}

          <div className="flex items-center gap-2 md:gap-4">

            <NotificationBell />

            <Link to="/profile" className="hover:text-orange-500 text-gray-600" ><User /></Link>

            {/* ปุ่มแฮมเบอร์เกอร์ (มือถือเท่านั้น) */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-gray-600 hover:text-orange-500 hover:bg-gray-100 transition"
              aria-label="เปิดเมนู"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

          </div>

        </div>

        {/* Menu (mobile, ยุบ/ขยาย) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-2 flex flex-col">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 py-2.5 text-sm text-orange-500 border-b border-gray-50"
            >
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link
              to="/searchbyimage"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50"
            >
              <Image size={20} />
              ค้นหาจากรูป
            </Link>
            <Link
              to="/allposts"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500"
            >
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>
        )}
      </nav>

      {/* ================= Hero ================= */}

      <section className="flex flex-col items-center justify-center mt-8 sm:mt-16 px-4 text-center">

        <PackageSearch className="w-16 h-16 sm:w-28 sm:h-28 mb-3 sm:mb-4 text-gray-700 stroke-[1.5]" />

        <h1 className="text-2xl sm:text-4xl font-semibold text-orange-500">
          ช่วยตามหาของหาย
        </h1>

        <h2 className="text-lg sm:text-2xl md:text-3xl font-semibold text-gray-700 mt-1 sm:mt-2">
          ในมหาวิทยาลัยนเรศวร
        </h2>

        <p className="mt-2 sm:mt-5 text-xs sm:text-base text-gray-600 ">
          ถ่ายรูปหรือบอกลักษณะ แล้วให้ AI ช่วยจับคู่กับของที่มีคนพบ
        </p>

        {/* Buttons */}

        <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-5 mt-5 sm:mt-8 w-full max-w-[260px] sm:max-w-none sm:w-auto">

          <Link to="/reportlost"
            className="
            bg-orange-500
            hover:bg-orange-600
            text-white
            px-5
            sm:px-8
            py-2.5
            sm:py-3.5
            rounded-full
            text-sm
            sm:text-lg
            font-semibold
            shadow-md
            transition-colors
            text-center
            "
          >
            แจ้งของหาย
          </Link>

          <Link to="/reportfound"
            className="
            bg-sky-500
            hover:bg-sky-600
            text-white
            px-5
            sm:px-8
            py-2.5
            sm:py-3.5
            rounded-full
            text-sm
            sm:text-lg
            font-semibold
            shadow-md
            transition-colors
            text-center
            "
          >
            แจ้งพบของ
          </Link>

        </div>

        {/* Search Image */}

        <Link to="/searchbyimage"
          className="
          mt-2.5
          sm:mt-4
          border-2
          border-orange-400
          hover:bg-orange-50
          rounded-full
          px-6
          sm:px-10
          py-2.5
          sm:py-3.5
          flex
          items-center
          justify-center
          gap-2
          sm:gap-2.5
          text-sm
          sm:text-lg
          font-semibold
          transition-colors
          w-full
          max-w-[260px]
          sm:w-auto
          sm:max-w-none
          "
        >
          <Search size={18} className="sm:hidden" />
          <Search size={22} className="hidden sm:block" />
          ค้นหาด้วยรูปภาพ
        </Link>

      </section>

    </div>
  );
}