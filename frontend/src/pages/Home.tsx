import { Link, useNavigate } from 'react-router-dom';
import Logo from "../components/Logo";
import {
  Home,
  Image,
  User,
  Search,
  PackageSearch,
  FileText,
  Menu,
  X,
  Backpack,
  Smartphone,
  KeyRound,
  Wallet,
  Sparkles,
  Bell
} from "lucide-react";
import { useState } from 'react';
import NotificationBell from '../components/NotificationBell';
import RecentPosts from '../components/RecentPosts';

// ชิปหมวดหมู่: ระบบยังไม่มีฟิลด์หมวด จึงเป็นทางลัดไปค้นหาด้วยคำในหน้าประกาศทั้งหมด
const QUICK_CATEGORIES = [
  { label: 'กระเป๋า', query: 'กระเป๋า', Icon: Backpack },
  { label: 'โทรศัพท์', query: 'โทรศัพท์', Icon: Smartphone },
  { label: 'กุญแจ', query: 'กุญแจ', Icon: KeyRound },
  { label: 'กระเป๋าสตางค์', query: 'กระเป๋าสตางค์', Icon: Wallet },
];

const STEPS = [
  { Icon: Image, title: '1. แจ้งโพสต์', desc: 'ถ่ายรูปหรือบอกลักษณะ ให้ AI ช่วยระบุชื่อสิ่งของ' },
  { Icon: Sparkles, title: '2. ระบบจับคู่', desc: 'เทียบความหมายกับโพสต์ฝั่งตรงข้าม' },
  { Icon: Bell, title: '3. รับแจ้งเตือน', desc: 'ตรวจสอบรายการที่น่าจะตรงและอ้างสิทธิ์' },
];

export default function HomePage() {


  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [searchType, setSearchType] = useState<'all' | 'lost' | 'found'>('all');

  // ค้นหาด่วน: พาไปหน้าประกาศทั้งหมดพร้อมคำค้นและประเภท (Allposts อ่านจาก URL)
  const goSearch = (query: string, type: string = searchType) => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (type !== 'all') params.set('type', type);
    const qs = params.toString();
    navigate(`/allposts${qs ? `?${qs}` : ''}`);
  };

  return (
    <div className="min-h-screen bg-cream antialiased">

      {/* Navbar */}

      <nav className="bg-white shadow-sm border-b border-gray-300">
        <div className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between px-4 md:px-8">

          <div className="flex items-center gap-3">

            <Logo />
          </div>


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


          <div className="flex items-center gap-2 md:gap-4">

            <NotificationBell />

            <Link to="/profile" className="hover:text-orange-500 text-gray-600" ><User /></Link>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-gray-600 hover:text-orange-500 hover:bg-gray-100 transition"
              aria-label="เปิดเมนู"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

          </div>

        </div>

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

      {/* Hero */}

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


        <div className="flex flex-row items-stretch justify-center gap-2 sm:gap-4 mt-5 sm:mt-8 w-full max-w-[340px] sm:max-w-none sm:w-auto">

          <Link to="/reportlost"
            className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white px-3 sm:px-8 py-2.5 sm:py-3.5 rounded-full text-xs sm:text-lg font-semibold shadow-md transition-colors text-center whitespace-nowrap"
          >
            แจ้งของหาย
          </Link>

          <Link to="/reportfound"
            className="flex-1 sm:flex-none bg-sky-500 hover:bg-sky-600 text-white px-3 sm:px-8 py-2.5 sm:py-3.5 rounded-full text-xs sm:text-lg font-semibold shadow-md transition-colors text-center whitespace-nowrap"
          >
            แจ้งพบของ
          </Link>

          <Link to="/searchbyimage"
            className="flex-1 sm:flex-none border-2 border-orange-400 hover:bg-orange-50 rounded-full px-3 sm:px-8 py-2 sm:py-3 flex items-center justify-center gap-1.5 sm:gap-2.5 text-xs sm:text-lg font-semibold transition-colors whitespace-nowrap"
          >
            <Search size={16} className="sm:hidden flex-shrink-0" />
            <Search size={22} className="hidden sm:block flex-shrink-0" />
            <span className="sm:hidden">ค้นด้วยรูป</span>
            <span className="hidden sm:inline">ค้นหาด้วยรูปภาพ</span>
          </Link>

        </div>


        <form
          onSubmit={(e) => { e.preventDefault(); goSearch(searchText); }}
          className="mt-6 sm:mt-8 w-full max-w-xl flex items-center gap-2 bg-white border border-gray-300 rounded-full pl-4 pr-1.5 py-1.5 shadow-sm focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100"
        >
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="ค้นหา เช่น กระเป๋าสตางค์สีดำ"
            aria-label="ค้นหาประกาศ"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm sm:text-base text-gray-800 placeholder:text-gray-400 py-1.5"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'all' | 'lost' | 'found')}
            aria-label="ประเภทประกาศ"
            className="bg-transparent text-xs sm:text-sm text-gray-600 border-l border-gray-200 pl-2 pr-1 py-1.5 outline-none cursor-pointer max-w-[84px] sm:max-w-none"
          >
            <option value="all">ทั้งหมด</option>
            <option value="lost">ของหาย</option>
            <option value="found">ของที่พบ</option>
          </select>
          <button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-full transition-colors flex-shrink-0"
          >
            ค้นหา
          </button>
        </form>


        <div className="mt-3 w-full max-w-xl flex flex-wrap justify-center gap-2">
          {QUICK_CATEGORIES.map(({ label, query, Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => goSearch(query, 'all')}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-orange-300 hover:text-orange-500 text-gray-600 text-xs sm:text-sm px-3 py-1.5 rounded-full transition-colors"
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

      </section>

      {/* Recent posts */}

      <RecentPosts />

      {/* How it works */}

      <section className="mt-12 sm:mt-16 bg-white/70 border-y border-gray-200 py-8 sm:py-10 px-4">
        <h3 className="text-base sm:text-xl font-bold text-gray-900 text-center mb-5 sm:mb-6">ใช้งานอย่างไร</h3>
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
          {STEPS.map(({ Icon, title, desc }) => (
            <div key={title} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
              <Icon className="w-7 h-7 sm:w-9 sm:h-9 text-orange-500 flex-shrink-0" />
              <div>
                <div className="text-sm sm:text-base font-semibold text-gray-900">{title}</div>
                <div className="text-xs sm:text-sm text-gray-600 mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}

      <footer className="px-4 py-6 text-center text-xs sm:text-sm text-gray-500">
        <div className="font-semibold text-gray-700">NUSeek · มหาวิทยาลัยนเรศวร</div>
        <div className="mt-1">พบของมีค่า? แจ้งผ่านระบบและเก็บรักษาไว้จนกว่าเจ้าของจะติดต่อ</div>
      </footer>

    </div>
  );
}