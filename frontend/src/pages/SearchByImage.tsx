import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  Image as ImageIcon,
  FileText,
  Bell,
  User,
  Upload,
  Camera,
  AlertTriangle,
  Search,
  RefreshCw,
  MapPin,
  Menu,
  X
} from "lucide-react";
import { searchByImage } from "../services/api";
import { getPlaceholderImage } from "../utils/placeholder";
import { useNotifications } from "../hooks/useNotifications";
import { formatRelativeTime } from "../utils/format";

const FALLBACK_IMAGE = getPlaceholderImage(300, 225);
const typeLabel = (type: string) => (type === "lost" ? "ของหาย" : "ของที่พบ");

export default function SearchByImage() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showNoti, setShowNoti] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

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
      const data = await searchByImage(selectedImage);
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
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50">
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link to="/searchbyimage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-orange-500 border-b border-gray-50">
              <ImageIcon size={20} />
              ค้นหาจากรูป
            </Link>
            <Link to="/allposts" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500">
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>
        )}
      </nav>

      {/* ================= Main Container ================= */}
      <div className="max-w-5xl mx-auto p-6 space-y-8 pt-10">

        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-gray-800">ค้นหาด้วยรูปภาพ</h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            อัปโหลดรูปภาพหรือถ่ายภาพสิ่งของที่พบ AI Agent จะช่วยวิเคราะห์และจับคู่ข้อมูลกับประกาศในมหาวิทยาลัย
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ฝั่งซ้าย: กล่องอัปโหลดรูปภาพ */}
          <div className="lg:col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[400px] flex flex-col justify-center items-center">

            {!previewUrl ? (
              <label className="w-full h-full min-h-[350px] border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-orange-400 transition group">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />

                <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-4 group-hover:scale-105 transition">
                  <Upload size={28} />
                </div>

                <p className="text-base font-semibold text-gray-700">ลากและวางรูปภาพที่นี่</p>
                <p className="text-xs text-gray-400 mt-1">เลือกไฟล์ภาพจากเครื่องของคุณ </p>

                <div className="flex gap-3 mt-6">
                  <span className="px-5 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-orange-600 transition">
                    เลือกรูปภาพ
                  </span>
                  <span className="px-5 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-sky-600 transition flex items-center gap-1.5">
                    <Camera size={14} />
                    ถ่ายรูป
                  </span>
                </div>
              </label>
            ) : (
              <div className="w-full flex flex-col items-center space-y-6">
                <div className="relative max-h-[350px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-inner">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-[350px] object-contain w-full"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleClearImage}
                    disabled={isAnalyzing}
                    className="px-5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw size={14} />
                    เปลี่ยนรูปภาพ
                  </button>

                  <button
                    onClick={handleStartSearch}
                    disabled={isAnalyzing}
                    className="px-8 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition flex items-center gap-2 shadow-sm disabled:bg-orange-400"
                  >
                    {isAnalyzing ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        กำลังวิเคราะห์ข้อมูล...
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        เริ่มค้นหาของหาย
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ฝั่งขวา: คำแนะนำการใช้งาน */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-800">คำแนะนำการเปรียบเทียบ</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  ผลลัพธ์นี้เป็นการช่วยวิเคราะห์และจับคู่ข้อมูลเบื้องต้นจากลักษณะของวัตถุเท่านั้น กรุณาตรวจสอบและเปรียบเทียบรายละเอียดเพิ่มเติมด้วยตนเอง โดยพิจารณาจากสถานที่และเวลาเพื่อความถูกต้องแม่นยำสูงสุด
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ================= ผลการค้นหา ================= */}
        {error && (
          <div className="text-center text-rose-500 py-6">{error}</div>
        )}

        {results !== null && !error && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-800">
              ผลการค้นหา ({results.length} รายการ)
            </h3>

            {results.length === 0 ? (
              <div className="text-center text-gray-400 py-16 bg-white rounded-2xl border border-gray-100">
                ไม่พบไอเทมที่คล้ายกันในระบบ
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/postdetail/${item.id}`)}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 transition-all flex flex-col cursor-pointer"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                      <img
                        src={item.image_url || FALLBACK_IMAGE}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-gray-100">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.type === "lost" ? "bg-rose-500" : "bg-emerald-500"}`} />
                        <span className="text-xs font-semibold text-gray-700">{typeLabel(item.type)}</span>
                      </div>
                      <div className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                        {Math.round((item.score || 0) * 100)}%
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-gray-800 line-clamp-2">
                        {item.title || "ไม่ระบุชื่อสิ่งของ"}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={13} className="text-gray-400" />
                        <span>{item.location || "ไม่ระบุสถานที่"}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}