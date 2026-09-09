import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import {
  User,
  Pencil,
  Bell,
  LogOut,
  PackageSearch,
  Home,
  Image,
  FileText,
  MapPin,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { getMyItems } from "../services/api";
import { formatRelativeTime } from "../utils/format";
import { getPlaceholderImage } from "../utils/placeholder";
import { useNotifications } from "../hooks/useNotifications";
import { getAvatarColor, getAvatarInitial } from "../utils/avatar";

interface UserProfile {
  display_name: string;
  email: string;
  avatar_url?: string | null;
}

const FALLBACK_IMAGE = getPlaceholderImage(200, 150);
const typeLabel = (type: string) => (type === "lost" ? "ของหาย" : "ของที่พบ");

// Avatar แบบ hybrid: มีรูป -> โชว์รูป, ไม่มีรูป -> ตัวอักษรแรก + สีจาก getAvatarColor (สูตรกลาง)
// ถ้าส่ง className มา จะใช้ className กำหนดขนาด (รองรับ responsive เช่น "w-20 h-20 sm:w-28 sm:h-28")
// ถ้าไม่ส่งจะ fallback ไปใช้ size (px) แบบเดิม
const Avatar = ({
  name,
  avatarUrl,
  size = 36,
  className = "",
  textClassName = "",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  textClassName?: string;
}) => {
  const sizeStyle = className ? undefined : { width: size, height: size };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={sizeStyle}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none ${className} ${textClassName}`}
      style={{
        ...sizeStyle,
        backgroundColor: getAvatarColor(name),
        fontSize: className ? undefined : size * 0.4,
      }}
    >
      {getAvatarInitial(name)}
    </div>
  );
};

export default function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNoti, setShowNoti] = useState(false);
  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const [arrowLeft, setArrowLeft] = useState<number | null>(null);

  // คำนวณตำแหน่งลูกศรให้ชี้ตรงกระดิ่งเสมอ ไม่ว่ากล่องแจ้งเตือนจะอยู่ตำแหน่งไหน
  // (มือถือ: กล่องอยู่กึ่งกลางจอ / จอใหญ่: กล่องยึดกับกระดิ่ง ตำแหน่งไม่เท่ากัน คำนวณสดเลยแม่นกว่า)
  useEffect(() => {
    if (showNoti && bellButtonRef.current && notifDropdownRef.current) {
      const bellRect = bellButtonRef.current.getBoundingClientRect();
      const dropdownRect = notifDropdownRef.current.getBoundingClientRect();
      const bellCenterX = bellRect.left + bellRect.width / 2;
      let left = bellCenterX - dropdownRect.left - 8;
      left = Math.max(12, Math.min(left, dropdownRect.width - 28));
      setArrowLeft(left);
    }
  }, [showNoti]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [myItems, setMyItems] = useState<any[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          navigate("/login");
          return;
        }

        const { data, error: dbError } = await supabase
          .from("users")
          .select("display_name, email, avatar_url")
          .eq("id", user.id)
          .single();

        if (dbError) throw dbError;

        if (data) {
          setProfile(data);
        }

        try {
          const items = await getMyItems(user.id);
          setMyItems(items || []);
        } catch (itemsErr) {
          console.error("Error fetching my items:", itemsErr);
        } finally {
          setItemsLoading(false);
        }
      } catch (error: any) {
        console.error("Error fetching profile:", error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [navigate]);

  const totalCount = myItems.length;
  // นับเฉพาะที่ยังไม่จบเคส (ไม่รวม matched) ให้ตัวเลขตรงกับที่เห็นจริงตอนกดแท็บ "ของหาย"/"ของที่พบ"
  const lostCount = myItems.filter((i) => i.type === "lost" && i.status !== "matched").length;
  const foundCount = myItems.filter((i) => i.type === "found" && i.status !== "matched").length;
  const matchedCount = myItems.filter((i) => i.status === "matched").length;

  const filteredItems = myItems.filter((item) => {
    if (activeTab === "all") return true;
    if (activeTab === "lost") return item.type === "lost" && item.status !== "matched";
    if (activeTab === "found") return item.type === "found" && item.status !== "matched";
    if (activeTab === "success") return item.status === "matched";
    return true;
  });

  const handleLogoutClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      navigate("/login");
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setShowLogoutModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 antialiased">

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
            <Link to="/" className="flex items-center gap-2 hover:text-orange-500">
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
                ref={bellButtonRef} onClick={() => setShowNoti(!showNoti)}
                className={`p-2 rounded-full transition relative ${showNoti ? "text-orange-500 bg-orange-50" : "text-gray-600 hover:text-orange-500 hover:bg-gray-100"
                  }`}
              >
                <Bell />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {showNoti && (
                <div ref={notifDropdownRef} className="fixed sm:absolute top-16 sm:top-12 left-1/2 -translate-x-1/2 w-[80vw] max-w-[300px] sm:translate-x-0 sm:left-auto sm:-right-16 sm:w-[92vw] sm:max-w-[360px] bg-white rounded-2xl border border-gray-200 shadow-xl z-50 font-kanit">
                  <div className="absolute -top-2 w-4 h-4 bg-white border-t border-l border-gray-200 rotate-45 z-10" style={{ left: arrowLeft !== null ? `${arrowLeft}px` : undefined, right: arrowLeft !== null ? undefined : '73px' }}></div>

                  <div className="relative z-20 bg-white rounded-2xl overflow-hidden">
                    <div className="flex justify-between items-center px-3 py-2.5 sm:px-5 sm:py-3.5 border-b border-gray-100">
                      <span className="font-bold text-gray-800 text-xs sm:text-sm">การแจ้งเตือน</span>
                      <button onClick={markAllRead} className="text-[10px] sm:text-xs font-semibold text-orange-500 hover:underline">อ่านทั้งหมด</button>
                    </div>

                    <div className="max-h-[260px] sm:max-h-[320px] overflow-y-auto divide-y divide-gray-100">
                      {notifications.length === 0 && (
                        <div className="p-6 text-center text-xs text-gray-400">ยังไม่มีแจ้งเตือน</div>
                      )}
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markOneRead(n.id);
                            const targetItemId = n.matched_item_id || n.item_id; if (targetItemId) navigate(`/postdetail/${targetItemId}`);
                          }}
                          className={`flex gap-2 p-2.5 sm:gap-3 sm:p-4 hover:bg-gray-50 transition cursor-pointer text-left ${n.is_read ? "" : "bg-orange-50/40"}`}
                        >
                          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9" />
                              <path d="M8 12l3 3 5-6" />
                            </svg>
                          </div>
                          <div className="flex flex-col gap-0.5 flex-1">
                            <p className="text-[10px] sm:text-[11px] text-gray-600 leading-normal">{n.message}</p>
                            <span className="text-[9px] sm:text-[10px] text-gray-400">{formatRelativeTime(n.created_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Link to="/profile" className="text-orange-500"><User /></Link>

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
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50">
              <Home size={20} />
              หน้าแรก
            </Link>
            <Link to="/searchbyimage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50">
              <Image size={20} />
              ค้นหาจากรูป
            </Link>
            <Link to="/allposts" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500">
              <FileText size={20} />
              ประกาศทั้งหมด
            </Link>
          </div>
        )}
      </nav>

      {/* ================= Header ================= */}

      <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

        {/* ================= Profile Card ================= */}

        <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-8">
          {loading ? (
            <div className="text-center py-4 text-gray-500 animate-pulse">กำลังโหลดข้อมูลโปรไฟล์...</div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-3 sm:gap-6">

              <div className="p-1 rounded-full border-4 border-white shadow-sm">
                <Avatar
                  name={profile?.display_name || ""}
                  avatarUrl={profile?.avatar_url}
                  className="w-20 h-20 sm:w-28 sm:h-28"
                  textClassName="text-2xl sm:text-4xl"
                />
              </div>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl sm:text-3xl font-semibold">
                  {profile?.display_name || "ไม่ระบุชื่อ"}
                </h2>

                <p className="text-gray-500 mt-1 sm:mt-2 text-sm sm:text-base">
                  {profile?.email || "no-email@nu.ac.th"}
                </p>
              </div>

              <Link to="/editprofile"
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 sm:px-5 sm:py-3 rounded-xl text-sm sm:text-base w-full md:w-auto justify-center"
              >
                <Pencil size={18} />
                แก้ไขโปรไฟล์
              </Link>

            </div>
          )}
        </div>

        {/* ================= Statistics ================= */}

        <div className="grid grid-cols-4 gap-1.5 sm:gap-5">
          <div className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-6 shadow-sm text-center">
            <h3 className="text-lg sm:text-4xl font-bold text-orange-500">{itemsLoading ? "-" : totalCount}</h3>
            <p className="text-gray-500 mt-0.5 sm:mt-2 text-[10px] sm:text-base leading-tight">ประกาศทั้งหมด</p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-6 shadow-sm text-center">
            <h3 className="text-lg sm:text-4xl font-bold text-red-500">{itemsLoading ? "-" : lostCount}</h3>
            <p className="text-gray-500 mt-0.5 sm:mt-2 text-[10px] sm:text-base leading-tight">ของที่หาย</p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-6 shadow-sm text-center">
            <h3 className="text-lg sm:text-4xl font-bold text-sky-500">{itemsLoading ? "-" : foundCount}</h3>
            <p className="text-gray-500 mt-0.5 sm:mt-2 text-[10px] sm:text-base leading-tight">ของที่พบ</p>
          </div>

          <div className="bg-white rounded-xl sm:rounded-2xl p-2 sm:p-6 shadow-sm text-center">
            <h3 className="text-lg sm:text-4xl font-bold text-green-500">{itemsLoading ? "-" : matchedCount}</h3>
            <p className="text-gray-500 mt-0.5 sm:mt-2 text-[10px] sm:text-base leading-tight">พบเจ้าของแล้ว</p>
          </div>
        </div>

        {/* ================= My Posts ================= */}

        <div className="bg-white rounded-3xl shadow-sm p-4 sm:p-6">

          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <Bell className="text-orange-500" size={20} />
              <h2 className="text-lg sm:text-xl font-semibold">
                ประกาศของฉัน
              </h2>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <Link
                to="/reportlost"
                className="flex-1 sm:flex-none text-center bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 sm:px-5 text-sm sm:text-base rounded-xl"
              >
                แจ้งของหาย
              </Link>

              <Link
                to="/reportfound"
                className="flex-1 sm:flex-none text-center bg-sky-500 hover:bg-sky-600 text-white px-3 py-2 sm:px-5 text-sm sm:text-base rounded-xl"
              >
                แจ้งพบของ
              </Link>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-5 sm:mt-8 flex-wrap">
            {[
              ["all", "ทั้งหมด"],
              ["lost", "ของหาย"],
              ["found", "ของที่พบ"],
              ["success", "พบเจ้าของแล้ว"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`whitespace-nowrap px-3 py-1.5 text-xs sm:px-5 sm:py-2 sm:text-base rounded-full transition
                ${activeTab === key
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ================= รายการประกาศของฉัน ================= */}

          {itemsLoading && (
            <div className="py-20 text-center text-gray-400 animate-pulse">กำลังโหลดประกาศ...</div>
          )}

          {!itemsLoading && filteredItems.length === 0 && (
            <div className="py-20 flex flex-col items-center">
              <PackageSearch size={70} className="text-gray-300" />
              <p className="text-gray-400 mt-5 text-lg">ยังไม่มีประกาศในหมวดนี้</p>
            </div>
          )}

          {!itemsLoading && filteredItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 mt-5 sm:mt-6">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/postdetail/${item.id}`)}
                  className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition cursor-pointer flex flex-row sm:flex-col"
                >
                  <div className="relative w-24 h-24 sm:w-full sm:aspect-[4/3] flex-shrink-0 bg-gray-100">
                    <img
                      src={item.image_url || FALLBACK_IMAGE}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                    {item.status !== "matched" && (
                      <div className="hidden sm:flex absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full items-center gap-1.5 shadow-sm text-xs font-semibold">
                        <span className={`w-2 h-2 rounded-full ${item.type === "lost" ? "bg-red-500" : "bg-sky-500"}`} />
                        {typeLabel(item.type)}
                      </div>
                    )}
                    {item.status === "matched" && (
                      <div className="hidden sm:block absolute top-2 left-2 bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm">
                        พบเจ้าของแล้ว
                      </div>
                    )}
                  </div>
                  <div className="p-3 sm:p-4 flex flex-col justify-center sm:justify-start gap-1 sm:space-y-2 min-w-0">
                    {item.status === "matched" ? (
                      <div className="sm:hidden text-[11px] font-semibold text-green-600">พบเจ้าของแล้ว</div>
                    ) : (
                      <div className="sm:hidden flex items-center gap-1.5 text-[11px] font-semibold">
                        <span className={`w-2 h-2 rounded-full ${item.type === "lost" ? "bg-red-500" : "bg-sky-500"}`} />
                        <span className={item.type === "lost" ? "text-red-600" : "text-sky-600"}>{typeLabel(item.type)}</span>
                      </div>
                    )}
                    <h4 className="text-sm sm:text-base font-semibold text-gray-800 line-clamp-1">{item.title || "ไม่ระบุชื่อสิ่งของ"}</h4>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500 truncate">
                      <MapPin size={13} className="flex-shrink-0" />
                      <span className="truncate">{item.location || "ไม่ระบุสถานที่"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-500">
                      <Clock size={13} className="flex-shrink-0" />
                      <span>{item.created_at ? formatRelativeTime(item.created_at) : "-"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ================= Logout ================= */}

        <button
          onClick={handleLogoutClick}
          className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-500 rounded-2xl py-2.5 sm:py-4 text-sm sm:text-base flex justify-center items-center gap-2 sm:gap-3 font-medium transition"
        >
          <LogOut size={18} className="sm:hidden" />
          <LogOut size={20} className="hidden sm:block" />
          ออกจากระบบ
        </button>

      </div>

      {/* ================= Logout Confirm Modal ================= */}

      {showLogoutModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-6 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <LogOut size={28} className="text-red-500" />
            </div>

            <h3 className="text-lg font-semibold text-gray-800">
              ยืนยันการออกจากระบบ
            </h3>
            <p className="text-gray-500 mt-2 text-sm">
              คุณต้องการออกจากระบบใช่หรือไม่?
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-3 font-medium transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmLogout}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-medium transition"
              >
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}