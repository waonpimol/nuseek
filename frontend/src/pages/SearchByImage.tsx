import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  Image as ImageIcon,
  FileText,
  User,
  Upload,
  Camera,
  AlertTriangle,
  Search,
  RefreshCw,
  Menu,
  MapPin,
  Clock,
  X,
  SearchX
} from "lucide-react";
import { searchByImage } from "../services/api";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import NotificationBell from "../components/NotificationBell";
import { getPlaceholderImage } from "../utils/placeholder";
import { formatRelativeTime } from "../utils/format";
import Spinner from "../components/Spinner";
import { supabase } from "../services/supabaseClient";
import LoadingOverlay from "../components/LoadingOverlay";

const FALLBACK_IMAGE = getPlaceholderImage(300, 225);



export default function SearchByImage() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
    }
  };

  const handleStartSearch = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const data = await searchByImage(selectedImage, user?.id);
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
      setError("ค้นหาไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResults(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-cream font-kanit">

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

          <div className="hidden md:flex items-center gap-8 text-gray-700">
            <Link to="/" className="flex items-center gap-2 hover:text-orange-500">
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link to="/searchbyimage" className="flex items-center gap-2 text-orange-500">
              <ImageIcon size={20} />
              ค้นหาจากรูป
            </Link>
            <Link to="/allposts" className="flex items-center gap-2 hover:text-orange-500">
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <NotificationBell />

            <Link to="/profile" className="hover:text-orange-500 text-gray-600">
              <User />
            </Link>

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
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50">
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link to="/searchbyimage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-orange-500 border-b border-gray-50">
              <ImageIcon size={20} />
              ค้นหาจากรูป
            </Link>
            <Link to="/allposts" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500">
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>
        )}
      </nav>

      {/* ================= Main Container ================= */}
      <div className="max-w-5xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-8 pt-5 sm:pt-10">

        <div className="text-center space-y-1 sm:space-y-2">
          <h2 className="text-xl sm:text-3xl font-bold text-gray-800">ค้นหาด้วยรูปภาพ</h2>
          <p className="text-gray-500 text-xs sm:text-sm max-w-lg mx-auto px-2">
            อัปโหลดรูปภาพหรือถ่ายภาพสิ่งของที่พบ AI Agent จะช่วยวิเคราะห์และจับคู่ข้อมูลกับประกาศในมหาวิทยาลัย
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 items-start">

          {/* ฝั่งซ้าย: กล่องอัปโหลดรูปภาพ */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-3 sm:p-6 shadow-sm border border-gray-100 min-h-[280px] sm:min-h-[400px] flex flex-col justify-center items-center">

            {!previewUrl ? (
              <label className="w-full h-full min-h-[240px] sm:min-h-[350px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-4 sm:p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-orange-400 transition group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                <div className="w-11 h-11 sm:w-16 sm:h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-2.5 sm:mb-4 group-hover:scale-105 transition">
                  <Upload size={20} className="sm:hidden" />
                  <Upload size={28} className="hidden sm:block" />
                </div>

                <p className="text-sm sm:text-base font-semibold text-gray-700">ลากและวางรูปภาพที่นี่</p>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-1">เลือกไฟล์ภาพจากเครื่องของคุณ </p>

                <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
                  <span className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-orange-500 text-white rounded-xl text-xs sm:text-sm font-medium shadow-sm hover:bg-orange-600 transition">
                    เลือกรูปภาพ
                  </span>
                  <span className="px-3.5 sm:px-5 py-1.5 sm:py-2 bg-sky-500 text-white rounded-xl text-xs sm:text-sm font-medium shadow-sm hover:bg-sky-600 transition flex items-center gap-1.5">
                    <Camera size={12} />
                    ถ่ายรูป
                  </span>
                </div>
              </label>
            ) : (
              <div className="w-full flex flex-col items-center space-y-4 sm:space-y-6">
                <div className="relative max-h-[240px] sm:max-h-[350px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-inner">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[240px] sm:max-h-[350px] object-contain w-full"
                  />
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={handleClearImage}
                    disabled={isAnalyzing}
                    className="px-3.5 sm:px-5 py-2 sm:py-2.5 border border-gray-300 rounded-xl text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={13} />
                    เปลี่ยนรูปภาพ
                  </button>

                  <button
                    onClick={handleStartSearch}
                    disabled={isAnalyzing}
                    className="px-5 sm:px-8 py-2 sm:py-2.5 bg-orange-500 text-white rounded-xl text-xs sm:text-sm font-medium hover:bg-orange-600 transition flex items-center gap-1.5 sm:gap-2 shadow-sm disabled:bg-orange-400"
                  >
                    {isAnalyzing ? (
                      <>
                        <Spinner size={15} />
                        กำลังวิเคราะห์ข้อมูล...
                      </>
                    ) : (
                      <>
                        <Search size={14} />
                        เริ่มค้นหาของหาย
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ฝั่งขวา: คำแนะนำการใช้งาน */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-3 sm:p-6 shadow-sm border border-gray-100 space-y-3 sm:space-y-4">
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-lg mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-gray-800">คำแนะนำการเปรียบเทียบ</h3>
                <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed">
                  ผลลัพธ์นี้เป็นการช่วยวิเคราะห์และจับคู่ข้อมูลเบื้องต้นจากลักษณะของวัตถุเท่านั้น กรุณาตรวจสอบและเปรียบเทียบรายละเอียดเพิ่มเติมด้วยตนเอง โดยพิจารณาจากสถานที่และเวลาเพื่อความถูกต้องแม่นยำสูงสุด
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ================= ผลการค้นหา ================= */}
        {error && (
          <ErrorState title={error} description="ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง" className="bg-white rounded-2xl border border-gray-100">
            <button onClick={handleStartSearch} className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">ลองใหม่</button>
          </ErrorState>
        )}

        {results !== null && !error && (
          <div className="space-y-3 sm:space-y-4">
            <h3 className="text-sm sm:text-lg font-bold text-gray-800">
              ผลการค้นหา ({results.length} รายการ)
            </h3>

            {results.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="ไม่พบสิ่งของที่คล้ายกันในระบบ"
                description="ลองถ่ายรูปใหม่ให้เห็นสิ่งของชัดขึ้น หรือแจ้งของหายไว้ ระบบจะแจ้งเตือนเมื่อมีคนพบของที่ตรงกัน"
                className="bg-white rounded-2xl border border-gray-100"
              >
                <Link to="/reportlost" className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">แจ้งของหาย</Link>
              </EmptyState>
            ) : (
              <div className="-mx-4 sm:mx-0 px-4 sm:px-0 pt-1 pb-8 -mb-4 flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:thin]">
                {results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/postdetail/${item.id}`)}
                    className="group w-[68%] sm:w-[320px] flex-shrink-0 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-200 ease-out flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.97] active:shadow-sm"
                  >
                    <div className="relative w-full aspect-[4/3] flex-shrink-0 overflow-hidden bg-gray-100">
                      <img
                        src={item.image_url || FALLBACK_IMAGE}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                      <div className={`flex absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full items-center shadow-sm select-none text-[11px] sm:text-xs font-semibold tracking-wide text-white ${item.type === "lost" ? "bg-red-500" : "bg-sky-500"}`}>
                        {item.type === "lost" ? "หาย" : "พบ"}
                      </div>
                      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-orange-500 text-white text-[11px] sm:text-xs font-bold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full shadow-sm">
                        {Math.round((item.score || 0) * 100)}%
                      </div>
                    </div>

                    <div className="p-3 sm:p-5 flex-1 flex flex-col gap-2 sm:gap-3 min-w-0">
                      <div className="w-6 sm:w-8 h-1 rounded-full bg-orange-500" />
                      <h4 className="text-base sm:text-2xl font-extrabold tracking-tight text-gray-900 leading-tight line-clamp-2 group-hover:text-orange-500 transition">
                        {item.title || "ไม่ระบุชื่อสิ่งของ"}
                      </h4>
                      <div className="space-y-1.5 sm:space-y-2 pt-2 sm:pt-2.5 border-t border-gray-100 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="truncate">{item.location || "ไม่ระบุสถานที่"}</span>
                        </div>
                        {item.created_at && (
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-gray-400 flex-shrink-0" />
                            <span>{formatRelativeTime(item.created_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {/* ช่องว่างท้ายแถว (มือถือ) ให้ปัดจนสุดแล้วการ์ดใบสุดท้ายไม่ติดขอบจอ */}
                <div className="w-1 flex-shrink-0 sm:hidden" aria-hidden="true" />
              </div>
            )}
          </div>
        )}

      </div>

      <LoadingOverlay
        open={isAnalyzing}
        messages={[
          "กำลังอัปโหลดรูปภาพ...",
          "AI กำลังวิเคราะห์รูปของคุณ...",
          "กำลังค้นหาสิ่งของที่ใกล้เคียง...",
          "กำลังตรวจสอบความตรงกันของผลลัพธ์...",
        ]}
      />
    </div>
  );
}