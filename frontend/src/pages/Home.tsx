import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Image,
  Bell,
  User,
  Search,
  Package,
  FileText,
  Menu,
  X
} from "lucide-react";
import { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/format';

export default function HomePage() {

  const navigate = useNavigate();
  const [showNoti, setShowNoti] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

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

            <div className="relative">

              <button
                onClick={() => setShowNoti(!showNoti)}
                className={`p-2 rounded-full transition relative ${showNoti ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-500 hover:bg-gray-100"
                  }`}
              >
                <Bell />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNoti && (
                <div className="absolute top-12 right-0 sm:right-auto sm:-right-16 w-[92vw] max-w-[360px] bg-white rounded-2xl border border-gray-200 shadow-xl z-50 font-kanit">


                  <div className="hidden sm:block absolute -top-2 right-[73px] w-4 h-4 bg-white border-t border-l border-gray-200 rotate-45 z-10"></div>

                  <div className="relative z-20 bg-white rounded-2xl overflow-hidden">
                    <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100">
                      <span className="font-bold text-gray-800 text-sm">การแจ้งเตือน</span>
                      <button onClick={markAllRead} className="text-xs font-semibold text-orange-500 hover:underline">อ่านทั้งหมด</button>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 && (
                        <div className="p-6 text-center text-xs text-gray-400">ยังไม่มีแจ้งเตือน</div>
                      )}
                      {notifications.map((n) => (
                      	<div
                      		key={n.id}
                      		onClick={() => {
                      			markOneRead(n.id);
                      			if (n.matched_item_id) navigate(`/postdetail/${n.matched_item_id}`);
                      		}}
                      		className={`flex gap-3 p-4 hover:bg-gray-50 transition cursor-pointer text-left ${n.is_read ? "" : "bg-orange-50/40"}`}
                      	>
                      		<div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M8 12l3 3 5-6" />
                            </svg>
                          </div>
                      		<div className="flex flex-col gap-0.5 flex-1">
                      			<p className="text-[11px] text-gray-600 leading-normal">{n.message}</p>
                      			<span className="text-[10px] text-gray-400">{formatRelativeTime(n.created_at)}</span>
                      		</div>
                      	</div>
                      ))}
                    </div>
                  </div>

                </div>
              )}

            </div>

            <Link to="/profile" className="hover:text-orange-500 text-gray-600"><User /></Link>

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
              className="flex items-center gap-3 py-3 text-orange-500 border-b border-gray-50"
            >
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link
              to="/searchbyimage"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50"
            >
              <Image size={20} />
              ค้นหาจากรูป
            </Link>
            <Link
              to="/allposts"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500"
            >
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>
        )}
      </nav>

      {/* ================= Hero ================= */}

      <section className="flex flex-col items-center justify-center mt-16 px-4 text-center">

        <Package className="w-24 h-24 mb-4 text-gray-400 stroke-[1.5]" />

        <h1 className="text-4xl font-semibold text-orange-500">
          ช่วยตามหาของหาย
        </h1>

        <h2 className="text-2xl md:text-3xl font-semibold text-gray-700 mt-2">
          ในมหาวิทยาลัยนเรศวร
        </h2>

        <p className="mt-5 text-base text-gray-600 ">
          ค้นหาของหายภายในมหาวิทยาลัยด้วย AI Agent
        </p>

        {/* Buttons */}

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 mt-8 w-full max-w-xs sm:max-w-none sm:w-auto">

          <Link to="/reportlost"
            className="
            bg-orange-500
            hover:bg-orange-600
            text-white
            px-8
            py-3.5
            rounded-full
            text-lg
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
            px-8
            py-3.5
            rounded-full
            text-lg
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
          mt-4
          border-2
          border-orange-400
          hover:bg-orange-50
          rounded-full
          px-10
          py-3.5
          flex
          items-center
          justify-center
          gap-2.5
          text-lg
          font-semibold
          transition-colors
          w-full
          max-w-xs
          sm:w-auto
          sm:max-w-none
          "
        >
          <Search size={22} />
          ค้นหาด้วยรูปภาพ
        </Link>

      </section>

    </div>
  );
}