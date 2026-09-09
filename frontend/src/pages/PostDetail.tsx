import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  Image as ImageIcon,
  FileText,
  Bell,
  User,
  MapPin,
  Clock,
  Info,
  ArrowLeft,
  CheckCircle2,
  Menu,
  X,
  Phone,
  MessageCircle,
  Link2,
  AtSign
} from 'lucide-react';
import { getItem, confirmMatch, claimItem, confirmClaim } from '../services/api';
import { formatRelativeTime, formatFullDate } from '../utils/format';
import { getPlaceholderImage } from '../utils/placeholder';
import { useNotifications } from '../hooks/useNotifications';
import { supabase } from '../services/supabaseClient';
import { getAvatarColor, getAvatarInitial } from '../utils/avatar';

const FALLBACK_IMAGE = getPlaceholderImage(600, 400);

// รวมช่องทางติดต่อทั้งหมดจากโปรไฟล์มาแสดงเป็นแถวๆ (โชว์เฉพาะช่องที่มีค่าจริง ไม่มีก็ไม่โชว์)
function ContactList({
  phone,
  lineId,
  facebookUrl,
  instagramUsername,
}: {
  phone?: string | null;
  lineId?: string | null;
  facebookUrl?: string | null;
  instagramUsername?: string | null;
}) {
  const hasAny = phone || lineId || facebookUrl || instagramUsername;
  if (!hasAny) {
    return <div style={{ fontSize: '12px', color: '#A0AEC0', marginTop: '2px' }}>ยังไม่ได้เพิ่มช่องทางติดต่อ</div>;
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12.5px',
    color: '#4A5568',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
      {phone && (
        <div style={rowStyle}>
          <Phone size={12} style={{ color: '#DD6B20' }} />
          <span>{phone}</span>
        </div>
      )}
      {lineId && (
        <div style={rowStyle}>
          <MessageCircle size={12} style={{ color: '#06C755' }} />
          <span>{lineId}</span>
        </div>
      )}
      {facebookUrl && (
        <div style={rowStyle}>
          <Link2 size={12} style={{ color: '#3B5998' }} />
          <span>{facebookUrl}</span>
        </div>
      )}
      {instagramUsername && (
        <div style={rowStyle}>
          <AtSign size={12} style={{ color: '#C13584' }} />
          <span>{instagramUsername}</span>
        </div>
      )}
    </div>
  );
}

export default function PostDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
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
  const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmingPost, setConfirmingPost] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!id) {
      setError("ไม่พบรหัสประกาศ");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPost() {
      setLoading(true);
      setError(null);
      try {
        const data = await getItem(id as string);
        if (!cancelled) setPost(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("ไม่พบประกาศนี้ หรือถูกลบไปแล้ว");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPost();
    return () => { cancelled = true; };
  }, [id]);

  // ปุ่มยืนยันโชว์ให้ "เจ้าของฝั่งของหาย" ในแมทช์นี้เท่านั้น ไม่ว่าจะกำลังดูโพสต์ไหนอยู่ก็ตาม
  // (ปกติจะมาจากการกดแจ้งเตือน แล้วเด้งมาที่โพสต์ "ของที่พบ" ของอีกฝั่ง ซึ่งไม่ใช่โพสต์ของเราเอง)
  const showConfirmButton =
    !!currentUserId &&
    !!post?.pending_match_id &&
    post?.pending_match_lost_owner_id === currentUserId;

  const handleConfirmOnPost = async () => {
    if (!post?.pending_match_id) return;
    setConfirmingPost(true);
    try {
      await confirmMatch(post.pending_match_id);
      // แมทช์ยืนยันแล้ว โพสต์นี้จะกลายเป็น matched และหายจากหน้าประกาศทั่วไป
      // พาไปหน้าประกาศทั้งหมดพร้อมข้อความสำเร็จ
      alert("ยืนยันเรียบร้อยแล้ว ขอบคุณที่แจ้งผลนะ 🎉");
      navigate("/allposts");
    } catch (err) {
      console.error(err);
      alert("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setConfirmingPost(false);
    }
  };

  // ปุ่ม "ใช่ของฉัน" — ใช้ตอนผู้ใช้เจอโพสต์ "ของที่พบ" เองผ่านการค้นหาด้วยรูป (ไม่ผ่านระบบแมทช์อัตโนมัติ)
  // โชว์เฉพาะโพสต์ประเภท "ของที่พบ" ที่ยังไม่จบเคส, ไม่ใช่โพสต์ของตัวเอง และยังไม่มีใครอ้างสิทธิ์ค้างอยู่
  // (ถ้ามีคนอ้างสิทธิ์ไปแล้ว จะโชว์ปุ่ม "ได้รับของคืนแล้ว" แทน กันสับสนว่าต้องกดปุ่มไหน)
  const showClaimButton =
    !!currentUserId &&
    post?.type === "found" &&
    post?.status !== "matched" &&
    post?.user_id !== currentUserId &&
    !post?.pending_claim_id;

  const handleClaim = async () => {
    if (!id || !currentUserId) return;
    setClaiming(true);
    try {
      await claimItem(id, currentUserId);
      setClaimed(true);
      alert("แจ้งเจ้าของโพสต์เรียบร้อยแล้ว! เดี๋ยวเขาจะติดต่อกลับไปนะ รอเจ้าของกดยืนยัน \"ได้รับของแล้ว\" อีกทีเคสจะปิดสมบูรณ์");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "แจ้งเจ้าของโพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setClaiming(false);
    }
  };

  // ปุ่ม "ได้รับของแล้ว/คืนของแล้ว" — กดได้ทั้ง 2 ฝ่าย (เจ้าของโพสต์ที่พบของ และผู้อ้างสิทธิ์ที่ทำของหาย)
  // ใครกดก่อนก็ปิดเคสได้เลย ไม่ต้องรอให้อีกฝั่งกดด้วย (แค่ยืนยันว่ามีการส่งคืนของกันจริงแล้ว)
  // กดแล้วถึงจะปิดเคสจริง: เปลี่ยนเป็น matched, หายจากหน้าประกาศทั่วไป, ไปนับใน KPI หน้าโปรไฟล์แทน
  const isPostOwner = !!currentUserId && post?.user_id === currentUserId;
  const isClaimant = !!currentUserId && post?.pending_claim_claimant_id === currentUserId;
  const showConfirmReceiptButton = !!post?.pending_claim_id && (isPostOwner || isClaimant);

  const handleConfirmReceipt = async () => {
    if (!post?.pending_claim_id || !currentUserId) return;
    setConfirmingReceipt(true);
    try {
      await confirmClaim(post.pending_claim_id, currentUserId);
      alert("ยืนยันเรียบร้อยแล้ว เคสนี้ปิดแล้วนะ 🎉");
      navigate("/allposts");
    } catch (err) {
      console.error(err);
      alert("ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setConfirmingReceipt(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-kanit">

      {/* ================= Navbar ================= */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold cursor-pointer" onClick={() => navigate('/')}>
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
            <Link to="/searchbyimage" className="flex items-center gap-2 hover:text-orange-500">
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
            <Link to="/profile" className="hover:text-orange-500 text-gray-600">
              <User size={22} />
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
            <Link to="/searchbyimage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50">
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

      {/* ================= Main Content ================= */}
      <div style={styles.container}>
        <div style={styles.wrapper}>

          <Link to="/allposts" style={styles.backBtn}>
            <ArrowLeft size={16} />
            กลับหน้าประกาศ
          </Link>

          {loading && (
            <div style={styles.stateBox}>กำลังโหลด...</div>
          )}

          {!loading && error && (
            <div style={styles.stateBox}>{error}</div>
          )}

          {!loading && !error && post && (
            <div style={styles.detailCard}>

              {/* หัวข้อโพสต์และสถานะ */}
              <div style={styles.headerRow}>
                <h1 style={styles.itemTitle}>{post.title || "ไม่ระบุชื่อสิ่งของ"}</h1>
                <span
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: post.type === "lost" ? "#FF2D38" : "#00A3EF",
                  }}
                >
                  {post.type === "lost" ? "หาย" : "พบ"}
                </span>
              </div>

              {/* ช่วงเวลาที่ลงโพสต์ */}
              <div style={styles.timeBadge}>
                <Clock size={14} style={{ color: '#718096' }} />
                <span>{post.created_at ? formatRelativeTime(post.created_at) : "-"}</span>
              </div>

              {/* สถานที่หายหรือพบ */}
              <div style={styles.locationRow}>
                <MapPin size={16} style={{ color: '#718096' }} />
                <span style={styles.locationText}>{post.location || "ไม่ระบุสถานที่"}</span>
              </div>

              {/* ส่วนจัดวางรูปภาพ */}
              <div style={styles.imageGrid}>
                <div style={styles.mainImageWrapper}>
                  <img
                    src={post.image_url || FALLBACK_IMAGE}
                    alt="Main"
                    style={styles.gridImage}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                </div>
              </div>

              {/* กล่องแจ้งว่ามีแมทช์รออยู่ + ปุ่มยืนยัน (โชว์เฉพาะเจ้าของโพสต์เอง) */}
              {showConfirmButton && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>AI ตรวจพบว่าสิ่งของนี้ตรงกับประกาศของหายของคุณ ถ้าตรวจสอบแล้วใช่จริง กดยืนยันได้เลย</span>
                  </div>
                  <button
                    onClick={handleConfirmOnPost}
                    disabled={confirmingPost}
                    style={styles.confirmMatchBtn}
                  >
                    {confirmingPost ? "กำลังยืนยัน..." : "ยืนยันว่าใช่ของฉัน"}
                  </button>
                </div>
              )}

              {/* ปุ่ม "ใช่ของฉัน" — สำหรับคนที่มาเจอโพสต์นี้เองผ่านการค้นหาด้วยรูป ไม่ได้มาจากระบบแมทช์อัตโนมัติ */}
              {showClaimButton && !claimed && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>คิดว่าสิ่งของนี้เป็นของคุณใช่ไหม? กดยืนยันเพื่อแจ้งให้เจ้าของโพสต์ติดต่อกลับ</span>
                  </div>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    style={styles.confirmMatchBtn}
                  >
                    {claiming ? "กำลังส่ง..." : "ใช่ของฉัน แจ้งเจ้าของโพสต์"}
                  </button>
                </div>
              )}

              {showClaimButton && claimed && (
                <div style={{ ...styles.matchBox, backgroundColor: '#F0FDF4' }}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>แจ้งเจ้าของโพสต์แล้ว รอเขาติดต่อกลับมาได้เลย</span>
                  </div>
                </div>
              )}

              {/* ปุ่ม "ได้รับของแล้ว" — เจ้าของโพสต์เท่านั้นที่เห็น หลังมีคนกด "ใช่ของฉัน" มา
                  กดปุ่มนี้แล้วถึงจะปิดเคสจริง (เปลี่ยนเป็น matched, หายจากหน้าประกาศทั่วไป) */}
              {showConfirmReceiptButton && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>
                      {isPostOwner
                        ? "มีคนแจ้งว่าของชิ้นนี้เป็นของเขา ถ้าส่งคืนของเรียบร้อยแล้ว กดยืนยันเพื่อปิดเคสได้เลย"
                        : "ถ้าได้รับของคืนจากเจ้าของโพสต์เรียบร้อยแล้ว กดยืนยันเพื่อปิดเคสได้เลย"}
                    </span>
                  </div>
                  <button
                    onClick={handleConfirmReceipt}
                    disabled={confirmingReceipt}
                    style={styles.confirmMatchBtn}
                  >
                    {confirmingReceipt
                      ? "กำลังยืนยัน..."
                      : isPostOwner
                        ? "ส่งคืนของแล้ว ปิดเคสนี้"
                        : "ได้รับของคืนแล้ว ปิดเคสนี้"}
                  </button>
                </div>
              )}

              {/* ส่วนหัวข้อรายละเอียด */}
              <div style={styles.sectionHeader}>
                <Info size={18} style={{ color: '#1A202C' }} />
                <span style={styles.sectionTitleText}>รายละเอียด</span>
              </div>

              <div style={styles.detailsContentBox}>
                {post.description || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>

              {/* ส่วนหัวข้อผู้ประกาศ */}
              <div style={styles.sectionHeader}>
                <User size={18} style={{ color: '#1A202C' }} />
                <span style={styles.sectionTitleText}>ผู้ประกาศ</span>
              </div>

              <div style={styles.reporterCard}>
                {post.reporter_avatar_url ? (
                  <img
                    src={post.reporter_avatar_url}
                    alt={post.reporter_name || "ผู้ประกาศ"}
                    style={{ ...styles.avatarCircle, objectFit: 'cover' as const }}
                  />
                ) : (
                  <div style={{ ...styles.avatarCircle, backgroundColor: getAvatarColor(post.reporter_name || "ผู้ประกาศ") }}>
                    <span style={styles.avatarInitial}>{getAvatarInitial(post.reporter_name || "ผู้ประกาศ")}</span>
                  </div>
                )}
                <div style={styles.reporterInfo}>
                  <div style={styles.reporterNameText}>{post.reporter_name || "ผู้ประกาศ"}</div>
                  <ContactList
                    phone={post.reporter_phone}
                    lineId={post.reporter_line_id}
                    facebookUrl={post.reporter_facebook_url}
                    instagramUsername={post.reporter_instagram_username}
                  />
                  <div style={styles.createdAtText}>
                    ประกาศเมื่อ {post.created_at ? formatFullDate(post.created_at) : "-"}
                  </div>
                </div>
              </div>

              {/* ส่วนแสดง "อีกฝั่ง" ที่แมทช์กันแล้ว (โชว์ก็ต่อเมื่อยืนยันแมทช์เรียบร้อยแล้วเท่านั้น) */}
              {post.matched_with && (
                <>
                  <div style={styles.sectionHeader}>
                    <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
                    <span style={styles.sectionTitleText}>
                      {post.type === "lost" ? "ผู้พบสิ่งของนี้" : "เจ้าของสิ่งของนี้"}
                    </span>
                  </div>

                  <div style={{ ...styles.reporterCard, backgroundColor: '#F0FDF4' }}>
                    {post.matched_with.reporter_avatar_url ? (
                      <img
                        src={post.matched_with.reporter_avatar_url}
                        alt={post.matched_with.reporter_name}
                        style={{ ...styles.avatarCircle, objectFit: 'cover' as const }}
                      />
                    ) : (
                      <div style={{ ...styles.avatarCircle, backgroundColor: getAvatarColor(post.matched_with.reporter_name) }}>
                        <span style={styles.avatarInitial}>{getAvatarInitial(post.matched_with.reporter_name)}</span>
                      </div>
                    )}
                    <div style={styles.reporterInfo}>
                      <div style={styles.reporterNameText}>{post.matched_with.reporter_name}</div>
                      <ContactList
                        phone={post.matched_with.reporter_phone}
                        lineId={post.matched_with.reporter_line_id}
                        facebookUrl={post.matched_with.reporter_facebook_url}
                        instagramUsername={post.matched_with.reporter_instagram_username}
                      />
                      <div
                        style={{ ...styles.createdAtText, color: '#166534', cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => navigate(`/postdetail/${post.matched_with.item_id}`)}
                      >
                        ดูโพสต์ "{post.matched_with.title}" ของอีกฝั่ง
                      </div>
                    </div>
                  </div>
                </>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '30px 15px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' },
  wrapper: { width: '100%', maxWidth: '640px', display: 'flex', flexDirection: 'column' as const, gap: '12px' },

  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'transparent', border: 'none', color: '#A0AEC0', fontSize: '13px', cursor: 'pointer', width: 'fit-content', padding: 0, textDecoration: 'none' },

  stateBox: { textAlign: 'center' as const, color: '#A0AEC0', padding: '60px 0' },

  detailCard: { backgroundColor: '#FFFFFF', borderRadius: '28px', border: '1px solid #E2E8F0', padding: '36px', display: 'flex', flexDirection: 'column' as const, gap: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.03)', boxSizing: 'border-box' },

  headerRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  itemTitle: { fontSize: '24px', fontWeight: 'bold', color: '#1A202C', margin: 0 },

  statusBadge: { color: '#FFFFFF', fontSize: '12px', fontWeight: 'bold', padding: '3px 10px', borderRadius: '12px', display: 'inline-block' },

  timeBadge: { display: 'flex', alignItems: 'center', gap: '6px', color: '#4A5568', fontSize: '13px', backgroundColor: '#E2E8F0', width: 'fit-content', padding: '4px 12px', borderRadius: '20px', fontWeight: '500' },
  locationRow: { display: 'flex', alignItems: 'center', gap: '6px', color: '#4A5568' },
  locationText: { fontSize: '14px', fontWeight: '500' },

  imageGrid: { display: 'flex', gap: '10px', width: '100%', height: '240px', marginTop: '6px', marginBottom: '6px' },
  mainImageWrapper: { flex: 1.6, borderRadius: '4px', overflow: 'hidden', border: '1px solid #000000' },
  gridImage: { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' },

  matchBox: { backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: '12px' },
  matchBoxText: { display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13.5px', color: '#166534', lineHeight: '1.5' },
  confirmMatchBtn: { alignSelf: 'flex-start', backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  sectionHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' },
  sectionTitleText: { fontSize: '14px', fontWeight: 'bold', color: '#1A202C' },

  detailsContentBox: { backgroundColor: '#EDF2F7', padding: '16px 20px', borderRadius: '16px', fontSize: '14px', color: '#1A202C', lineHeight: '1.6', border: 'none', whiteSpace: 'pre-line' as const },

  reporterCard: { backgroundColor: '#EDF2F7', padding: '16px', borderRadius: '16px', display: 'flex', gap: '14px', alignItems: 'center', width: '100%', maxWidth: '280px', boxSizing: 'border-box' },
  avatarCircle: { width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#A0AEC0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitial: { color: '#FFFFFF', fontSize: '20px', fontWeight: 'bold', userSelect: 'none' as const },
  reporterInfo: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  reporterNameText: { fontSize: '14px', fontWeight: 'bold', color: '#1A202C' },
  reporterPhoneText: { fontSize: '13px', color: '#718096' },
  createdAtText: { fontSize: '11px', color: '#A0AEC0', marginTop: '2px' }
};