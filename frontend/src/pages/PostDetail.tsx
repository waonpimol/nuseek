import React, { useState, useEffect, useRef } from 'react';
import Logo from "../components/Logo";
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  Image as ImageIcon,
  FileText,
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
  AtSign,
  Pencil,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import { getItem, confirmMatch, rejectMatch, completeMatch, claimItem, confirmClaim, cancelHandover, updateOwnItem, deleteOwnItem, closeOwnItem } from '../services/api';
import { formatRelativeTime, formatFullDate } from '../utils/format';
import { getPlaceholderImage } from '../utils/placeholder';
import NotificationBell from '../components/NotificationBell';
import { supabase } from '../services/supabaseClient';
import { getAvatarColor, getAvatarInitial } from '../utils/avatar';
import ResultModal from '../components/ResultModal';
import PageLoader from '../components/PageLoader';
import ErrorState from '../components/ErrorState';
import EditPostModal from '../components/EditPostModal';
import SimilarPosts from '../components/SimilarPosts';

const FALLBACK_IMAGE = getPlaceholderImage(600, 400);

// ช่องทางติดต่อจากโปรไฟล์ โชว์เฉพาะช่องที่มีค่า
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
          <Phone size={12} style={{ color: '#E05F00' }} />
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [confirmingPost, setConfirmingPost] = useState(false);
  const [rejectingPost, setRejectingPost] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [confirmingReceipt, setConfirmingReceipt] = useState(false);
  const [completingMatch, setCompletingMatch] = useState(false);
  // "ย้อนไปตามหาใหม่" ระหว่างรอส่งมอบ: เก็บว่ากำลังยกเลิกแทร็กไหน (แมทช์ AI หรืออ้างสิทธิ์) เพื่อเปิด modal ยืนยัน
  const [cancelTarget, setCancelTarget] = useState<"matches" | "claims" | null>(null);
  const [cancellingHandover, setCancellingHandover] = useState(false);
  // แกลเลอรีรูป: index ของรูปที่กำลังดูอยู่ (รีเซ็ตเป็นรูปแรกเมื่อเปลี่ยนโพสต์)
  const [activeImage, setActiveImage] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setActiveImage(0); }, [id]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closingPost, setClosingPost] = useState(false);
  // เมนู ⋯ ของเจ้าของโพสต์ (แก้ไข/ลบ)
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ownerMenuOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target as Node)) setOwnerMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOwnerMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ownerMenuOpen]);

  // แจ้งผลลัพธ์การกระทำต่างๆ ในหน้านี้ (ยืนยัน/ปฏิเสธ/ปิดเคส) ด้วย modal ในแอปเอง
  const [resultModal, setResultModal] = useState<{ success: boolean; title: string; message: string; goToAllPosts?: boolean } | null>(null);
  // modal ยืนยัน "ไม่ใช่ของฉัน" ก่อน reject จริง
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

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

  // ล็อกโพสต์เฉพาะตอนกำลังส่งมอบของ (แมทช์ confirmed หรือมีคำอ้างสิทธิ์ค้าง) ฝั่งไหนเข้าขั้นส่งมอบก่อนได้ไป
  // แมทช์ที่ AI แค่เสนอ (pending) ไม่ล็อก เจ้าของตัวจริงที่หาเจอเองยังกดอ้างสิทธิ์ได้
  const inHandover = !!post?.confirmed_match_id || !!post?.pending_claim_id;

  // ปุ่มยืนยันโชว์ให้ "เจ้าของฝั่งของหาย" ในแมทช์นี้เท่านั้น ไม่ว่าจะกำลังดูโพสต์ไหนอยู่ก็ตาม
  // (ปกติจะมาจากการกดแจ้งเตือน แล้วเด้งมาที่โพสต์ "ของที่พบ" ของอีกฝั่ง ซึ่งไม่ใช่โพสต์ของเราเอง)
  const showConfirmButton =
    !!currentUserId &&
    !!post?.pending_match_id &&
    post?.pending_match_lost_owner_id === currentUserId &&
    !inHandover;

  // สเตจ 1 เท่านั้น: แค่ยืนยัน "ตัวตน" ว่าใช่ของจริง ยังไม่ปิดเคส ไอเทมยังคง active ตามปกติ
  // รอสเตจ 2 (ปุ่ม "ได้รับของแล้ว") อีกทีถึงจะปิดเคสจริง
  const handleConfirmOnPost = async () => {
    if (!post?.pending_match_id) return;
    setConfirmingPost(true);
    try {
      await confirmMatch(post.pending_match_id);
      // โหลดโพสต์ใหม่ให้ state อัปเดตเป็นสเตจ 2 ทันที ไม่ต้องรีเฟรชเอง
      const refreshed = await getItem(id as string);
      setPost(refreshed);
      setResultModal({
        success: true,
        title: "ยืนยันตัวตนแล้ว",
        message: "ระบบได้แจ้งผู้พบสิ่งของให้ติดต่อเพื่อนัดรับคืนแล้ว เมื่อได้รับสิ่งของคืน กรุณากดยืนยันเพื่อปิดประกาศ",
      });
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setConfirmingPost(false);
    }
  };

  // ปุ่ม "ไม่ใช่ของฉัน" — ยกเลิกแมทช์นี้ทิ้ง เผื่อ AI จับคู่ผิด ของทั้งคู่ยัง active ต่อไปตามปกติ
  const handleRejectOnPost = async () => {
    if (!post?.pending_match_id) return;
    setRejectingPost(true);
    try {
      await rejectMatch(post.pending_match_id);
      setRejected(true);
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setRejectingPost(false);
    }
  };

  // ปุ่มอ้างสิทธิ์/แจ้งว่าเจอของ — ใช้ตอนผู้ใช้เจอโพสต์เองผ่านการค้นหาด้วยรูปหรือไล่ดูหน้าประกาศ
  // (ไม่ผ่านระบบแมทช์อัตโนมัติ) ใช้ได้ทั้งสองทิศทาง:
  //   - โพสต์ "ของที่พบ" → ปุ่ม "ใช่ของฉัน" (คนที่ทำของหายกดอ้างว่าเป็นของตัวเอง)
  //   - โพสต์ "ของหาย"   → ปุ่ม "เจอของชิ้นนี้แล้ว" (คนที่เจอของกดแจ้งเจ้าของ)
  // โชว์ให้ทุกโพสต์ที่ยังไม่จบเคส, ไม่ใช่โพสต์ของตัวเอง, ยังไม่มีใครอ้างสิทธิ์ค้างอยู่
  // และโพสต์ไม่ได้อยู่ระหว่างส่งมอบ (ดู inHandover ด้านบน)
  const showClaimButton =
    !!currentUserId &&
    post?.status !== "matched" &&
    post?.user_id !== currentUserId &&
    !inHandover;

  const handleClaim = async () => {
    if (!id || !currentUserId) return;
    setClaiming(true);
    try {
      await claimItem(id, currentUserId);
      setClaimed(true);
      setResultModal({
        success: true,
        title: "แจ้งเจ้าของประกาศเรียบร้อยแล้ว",
        message:
          post?.type === "lost"
            ? "ระบบได้แจ้งเจ้าของประกาศว่าคุณพบสิ่งของแล้ว กรุณารอการติดต่อกลับ เมื่อส่งมอบสิ่งของเรียบร้อย กรุณากดยืนยันเพื่อปิดประกาศ"
            : "ระบบได้แจ้งเจ้าของประกาศแล้ว กรุณารอการติดต่อกลับ เมื่อส่งมอบสิ่งของเรียบร้อย กรุณากดยืนยันเพื่อปิดประกาศ",
      });
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "แจ้งเจ้าของโพสต์ไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setClaiming(false);
    }
  };

  // ปุ่ม "ได้รับของแล้ว/คืนของแล้ว" — กดได้ทั้ง 2 ฝ่าย (เจ้าของโพสต์ และผู้อ้างสิทธิ์)
  // ใครกดก่อนก็ปิดเคสได้เลย ไม่ต้องรอให้อีกฝั่งกดด้วย (แค่ยืนยันว่ามีการส่งคืนของกันจริงแล้ว)
  // กดแล้วถึงจะปิดเคสจริง: เปลี่ยนเป็น matched, หายจากหน้าประกาศทั่วไป, ไปนับใน KPI หน้าโปรไฟล์แทน
  const isPostOwner = !!currentUserId && post?.user_id === currentUserId;
  const isClaimant = !!currentUserId && post?.pending_claim_claimant_id === currentUserId;
  const showConfirmReceiptButton = !!post?.pending_claim_id && (isPostOwner || isClaimant) && !post?.confirmed_match_id;

  // ทิศทางการส่งมอบสลับตามประเภทโพสต์:
  //   - ของที่พบ → เจ้าของโพสต์ส่งคืน / ผู้อ้างสิทธิ์รับคืน
  //   - ของหาย   → เจ้าของโพสต์รับคืน / ผู้อ้างสิทธิ์ส่งคืน
  const postOwnerReceives = post?.type === "lost";
  const isGiver = postOwnerReceives ? isClaimant : isPostOwner;

  const receiptStageText = isGiver
    ? (postOwnerReceives
      ? "เมื่อส่งคืนสิ่งของเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ"
      : "มีผู้แจ้งว่าเป็นเจ้าของสิ่งของนี้ เมื่อส่งคืนเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ")
    : (postOwnerReceives
      ? "มีผู้แจ้งว่าพบสิ่งของนี้ เมื่อได้รับคืนเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ"
      : "เมื่อได้รับสิ่งของคืนเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ");
  const receiptStageBtnLabel = isGiver ? "ส่งคืนของแล้ว ปิดประกาศ" : "ได้รับของคืนแล้ว ปิดประกาศ";

  const handleConfirmReceipt = async () => {
    if (!post?.pending_claim_id || !currentUserId) return;
    setConfirmingReceipt(true);
    try {
      await confirmClaim(post.pending_claim_id, currentUserId);
      setResultModal({ success: true, title: "ปิดประกาศเรียบร้อยแล้ว", message: "ระบบได้บันทึกการส่งมอบและปิดประกาศเรียบร้อยแล้ว", goToAllPosts: true });
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setConfirmingReceipt(false);
    }
  };

  // ปุ่ม "ได้รับของแล้ว/คืนของแล้ว" ฝั่งแทร็ก AI auto-match (สเตจ 2 ของ matches ไม่ใช่ claims)
  // โชว์ให้ทั้งเจ้าของของหายและผู้แจ้งพบ หลังจากเจ้าของของหายกด "ใช่ของฉัน" ยืนยันตัวตนแล้ว (สเตจ 1)
  const isMatchLostOwner = !!currentUserId && post?.confirmed_match_lost_owner_id === currentUserId;
  const isMatchFoundOwner = !!currentUserId && post?.confirmed_match_found_owner_id === currentUserId;
  const showMatchReceiptButton = !!post?.confirmed_match_id && (isMatchLostOwner || isMatchFoundOwner);

  const handleCompleteMatch = async () => {
    if (!post?.confirmed_match_id || !currentUserId) return;
    setCompletingMatch(true);
    try {
      await completeMatch(post.confirmed_match_id, currentUserId);
      setResultModal({ success: true, title: "ปิดประกาศเรียบร้อยแล้ว", message: "ระบบได้บันทึกการส่งมอบและปิดประกาศเรียบร้อยแล้ว", goToAllPosts: true });
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ยืนยันไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setCompletingMatch(false);
    }
  };

  const handleCancelHandover = async () => {
    const handoverId = cancelTarget === "matches" ? post?.confirmed_match_id : post?.pending_claim_id;
    if (!cancelTarget || !handoverId || !currentUserId) return;
    setCancellingHandover(true);
    try {
      await cancelHandover(cancelTarget, handoverId, currentUserId);
      setPost(await getItem(id as string));
      setResultModal({
        success: true,
        title: "กลับไปตามหาใหม่แล้ว",
        message: "ยกเลิกการส่งมอบแล้ว ประกาศยังเปิดอยู่ตามเดิม และแจ้งอีกฝ่ายให้ทราบแล้ว",
      });
    } catch (err: any) {
      console.error(err);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setCancellingHandover(false);
      setCancelTarget(null);
    }
  };

  const galleryImages: string[] = post?.image_urls?.length ? post.image_urls : post?.image_url ? [post.image_url] : [];
  const goToImage = (i: number) => {
    const el = galleryRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(i, galleryImages.length - 1));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  };

  // แก้ไข/ลบได้เฉพาะโพสต์ที่ยังไม่จบเคส ระหว่างส่งมอบของแก้ไขไม่ได้แต่ลบได้ (อีกฝั่งจะได้รับแจ้ง)
  const showOwnerTools = isPostOwner && post?.status !== "matched";
  const canEditPost = showOwnerTools && !post?.confirmed_match_id && !post?.pending_claim_id;

  const handleSaveEdit = async (values: { title: string; description: string; location: string }) => {
    if (!id || !currentUserId) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      await updateOwnItem(id, currentUserId, values);
      setPost((prev: any) => ({
        ...prev,
        title: values.title.trim(),
        description: values.description.trim(),
        location: values.location.trim(),
      }));
      setShowEditModal(false);
      setResultModal({ success: true, title: "แก้ไขแล้ว", message: "บันทึกการแก้ไขประกาศเรียบร้อย" });
    } catch (err: any) {
      console.error(err);
      setEditError(err?.message || "แก้ไขไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSavingEdit(false);
    }
  };

  // ได้ของคืน / คืนเจ้าของแล้วนอกขั้นตอนส่งมอบในระบบ เจ้าของปิดประกาศเอง
  const closeLabel = post?.type === "lost" ? "ได้ของคืนแล้ว" : "คืนเจ้าของแล้ว";
  const handleClosePost = async () => {
    if (!id || !currentUserId) return;
    setClosingPost(true);
    try {
      await closeOwnItem(id, currentUserId);
      setPost(await getItem(id));
      setShowCloseConfirm(false);
      setResultModal({ success: true, title: "ปิดประกาศแล้ว", message: "ปิดประกาศเรียบร้อยแล้ว ประกาศนี้จะแสดงในหมวด \"พบเจ้าของแล้ว\" ในโปรไฟล์ของคุณ" });
    } catch (err: any) {
      console.error(err);
      setShowCloseConfirm(false);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ปิดประกาศไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setClosingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!id || !currentUserId) return;
    setDeleting(true);
    try {
      await deleteOwnItem(id, currentUserId);
      setShowDeleteConfirm(false);
      setResultModal({ success: true, title: "ลบประกาศแล้ว", message: "ประกาศนี้ถูกลบออกจากระบบเรียบร้อย", goToAllPosts: true });
    } catch (err: any) {
      console.error(err);
      setShowDeleteConfirm(false);
      setResultModal({ success: false, title: "เกิดข้อผิดพลาด", message: err?.message || "ลบไม่สำเร็จ ลองใหม่อีกครั้ง" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-cream font-kanit"
      style={{ backgroundImage: "linear-gradient(180deg, rgba(251,146,60,0.12) 0%, rgba(251,146,60,0) 340px)", backgroundRepeat: "no-repeat" }}
    >

      {/* ================= Navbar ================= */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto h-16 md:h-20 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Logo />
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
            <NotificationBell />
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
            <PageLoader />
          )}

          {!loading && error && (
            <ErrorState title={error} description="ลองกลับไปที่หน้าประกาศแล้วเลือกใหม่อีกครั้ง" />
          )}

          {!loading && !error && post && (
            <div style={styles.detailCard} className="flex flex-col lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
              {(() => {
                return (
                  <>
                    <div className="relative w-full bg-white lg:h-full">
                      <div
                        ref={galleryRef}
                        onScroll={() => {
                          const el = galleryRef.current;
                          if (el && el.clientWidth) setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
                        }}
                        className="flex w-full lg:h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {(galleryImages.length ? galleryImages : [FALLBACK_IMAGE]).map((url, i) => (
                          <div key={url + i} className="relative w-full flex-shrink-0 snap-center flex items-center justify-center h-[300px] sm:h-[420px] lg:h-auto p-3 pb-6 lg:p-6 overflow-hidden bg-white">
                            <img
                              src={url}
                              alt={`รูปที่ ${i + 1}`}
                              draggable={false}
                              className="relative max-w-full max-h-full object-contain rounded-xl border border-gray-200 bg-white shadow-sm lg:w-auto lg:h-auto lg:max-h-[68vh] lg:rounded-2xl lg:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                              }}
                            />
                          </div>
                        ))}
                      </div>


                      {galleryImages.length > 1 && (
                        <>
                          <span className="absolute top-5 right-5 lg:top-9 lg:right-9 text-xs font-semibold text-white bg-black/55 rounded-full px-2.5 py-0.5 select-none pointer-events-none">
                            {activeImage + 1}/{galleryImages.length}
                          </span>
                          {activeImage > 0 && (
                            <button
                              type="button"
                              aria-label="รูปก่อนหน้า"
                              onClick={() => goToImage(activeImage - 1)}
                              className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white transition"
                            >
                              <ChevronLeft size={20} />
                            </button>
                          )}
                          {activeImage < galleryImages.length - 1 && (
                            <button
                              type="button"
                              aria-label="รูปถัดไป"
                              onClick={() => goToImage(activeImage + 1)}
                              className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow hover:bg-white transition"
                            >
                              <ChevronRight size={20} />
                            </button>
                          )}
                          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                            {galleryImages.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-4 bg-orange-500' : 'w-1.5 bg-gray-300'}`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}

              <div style={styles.cardBody}>

              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h1 style={styles.itemTitle}>{post.title || "ไม่ระบุชื่อสิ่งของ"}</h1>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-semibold text-white select-none flex-shrink-0"
                      style={{ backgroundColor: post.status === "matched" ? "#00c950" : post.type === "lost" ? "#FF2D38" : "#00A3EF" }}
                    >
                      {post.status === "matched" ? "สำเร็จ" : post.type === "lost" ? "หาย" : "พบ"}
                    </span>
                  </div>
                  <div className="mt-2 w-8 h-1 rounded-full bg-orange-500" />
                </div>
                {showOwnerTools && (
                  <div className="relative flex-shrink-0" ref={ownerMenuRef}>
                    <button
                      type="button"
                      aria-label="เมนูจัดการประกาศ"
                      aria-haspopup="menu"
                      aria-expanded={ownerMenuOpen}
                      onClick={() => setOwnerMenuOpen((o) => !o)}
                      className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition"
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {ownerMenuOpen && (
                      <div role="menu" className="absolute right-0 top-11 z-20 w-44 bg-white rounded-xl border border-gray-100 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.2)] py-1.5">
                        {canEditPost && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { setOwnerMenuOpen(false); setEditError(null); setShowEditModal(true); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition"
                          >
                            <Pencil size={15} /> แก้ไขประกาศ
                          </button>
                        )}
                        {canEditPost && (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={closingPost}
                            onClick={() => { setOwnerMenuOpen(false); setShowCloseConfirm(true); }}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-green-700 hover:bg-green-50 transition disabled:opacity-50"
                          >
                            <CheckCircle2 size={15} /> {closeLabel}
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          disabled={deleting}
                          onClick={() => { setOwnerMenuOpen(false); setShowDeleteConfirm(true); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                        >
                          <Trash2 size={15} /> ลบประกาศ
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ข้อมูลหลัก: สถานที่ + เวลา เป็นการ์ดไอคอน */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 rounded-2xl bg-orange-50 px-3 py-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-orange-100 text-orange-500 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500">สถานที่</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-800 break-words leading-snug">{post.location || "ไม่ระบุสถานที่"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl bg-sky-50 px-3 py-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-full bg-sky-100 text-sky-500 flex items-center justify-center flex-shrink-0">
                    <Clock size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-500">{post.status === "matched" && post.resolved_at ? "ปิดประกาศ" : "ลงประกาศ"}</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-800 leading-snug">
                      {post.status === "matched" && post.resolved_at
                        ? formatRelativeTime(post.resolved_at)
                        : post.created_at ? formatRelativeTime(post.created_at) : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* กล่องแจ้งว่ามีแมทช์รออยู่ + ปุ่มยืนยัน/ไม่ใช่ของฉัน (โชว์เฉพาะเจ้าของของหายเอง) */}
              {showConfirmButton && !rejected && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>ระบบพบว่าสิ่งของนี้อาจตรงกับประกาศของหายของคุณ กรุณาตรวจสอบรายละเอียด หากใช่สิ่งของของคุณ กรุณากดยืนยัน หากไม่ใช่ กรุณากดปฏิเสธ</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' as const }}>
                    <button
                      onClick={handleConfirmOnPost}
                      disabled={confirmingPost || rejectingPost}
                      style={styles.confirmMatchBtn}
                    >
                      {confirmingPost ? "กำลังยืนยัน..." : "ยืนยันว่าใช่ของฉัน"}
                    </button>
                    <button
                      onClick={() => setShowRejectConfirm(true)}
                      disabled={confirmingPost || rejectingPost}
                      style={styles.rejectMatchBtn}
                    >
                      {rejectingPost ? "กำลังดำเนินการ..." : "ไม่ใช่ของฉัน"}
                    </button>
                  </div>
                </div>
              )}

              {rejected && (
                <div style={{ ...styles.matchBox, backgroundColor: '#F7FAFC', borderColor: '#E2E8F0' }}>
                  <div style={{ ...styles.matchBoxText, color: '#4A5568' }}>
                    <CheckCircle2 size={20} style={{ color: '#A0AEC0', flexShrink: 0 }} />
                    <span>ยกเลิกการจับคู่นี้แล้ว หากมีประกาศที่ตรงกันเข้ามาใหม่ ระบบจะแจ้งเตือนให้ทราบ</span>
                  </div>
                </div>
              )}

              {/* ปุ่ม "ได้รับของแล้ว/คืนของแล้ว" ฝั่งแทร็ก AI auto-match — โชว์ให้ทั้งเจ้าของของหาย
                  และผู้แจ้งพบ หลังจากเจ้าของของหายกด "ใช่ของฉัน" ยืนยันตัวตนแล้ว (สเตจ 1 จบ) */}
              {showMatchReceiptButton && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>
                      {isMatchLostOwner
                        ? "ยืนยันตัวตนแล้ว เมื่อได้รับสิ่งของคืนเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ"
                        : "เจ้าของยืนยันแล้วว่าเป็นสิ่งของของตน เมื่อส่งคืนเรียบร้อยแล้ว กรุณากดยืนยันเพื่อปิดประกาศ"}
                    </span>
                  </div>
                  <button
                    onClick={handleCompleteMatch}
                    disabled={completingMatch}
                    style={styles.confirmMatchBtn}
                  >
                    {completingMatch
                      ? "กำลังยืนยัน..."
                      : isMatchLostOwner
                        ? "ได้รับของคืนแล้ว ปิดประกาศ"
                        : "ส่งคืนของแล้ว ปิดประกาศ"}
                  </button>
                  <button
                    onClick={() => setCancelTarget("matches")}
                    disabled={completingMatch || cancellingHandover}
                    style={styles.rejectMatchBtn}
                  >
                    ย้อนไปตามหาใหม่
                  </button>
                </div>
              )}

              {showClaimButton && claimed && (
                <div style={{ ...styles.matchBox, backgroundColor: '#F0FDF4' }}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>
                      {post.type === "lost"
                        ? "แจ้งเจ้าของประกาศแล้วว่าคุณพบสิ่งของนี้ กรุณารอการติดต่อกลับ"
                        : "แจ้งเจ้าของประกาศแล้ว กรุณารอการติดต่อกลับ"}
                    </span>
                  </div>
                </div>
              )}

              {/* ปุ่ม "ได้รับของแล้ว/คืนของแล้ว" — เห็นได้ทั้งเจ้าของโพสต์และผู้อ้างสิทธิ์ หลังมีการอ้างสิทธิ์เกิดขึ้น
                  กดปุ่มนี้แล้วถึงจะปิดเคสจริง (เปลี่ยนเป็น matched, หายจากหน้าประกาศทั่วไป)
                  ข้อความ/ป้ายปุ่มสลับฝั่งกันตามประเภทโพสต์ (ดู receiptStageText/receiptStageBtnLabel ด้านบน) */}
              {showConfirmReceiptButton && (
                <div style={styles.matchBox}>
                  <div style={styles.matchBoxText}>
                    <CheckCircle2 size={20} style={{ color: '#16A34A', flexShrink: 0 }} />
                    <span>{receiptStageText}</span>
                  </div>
                  <button
                    onClick={handleConfirmReceipt}
                    disabled={confirmingReceipt}
                    style={styles.confirmMatchBtn}
                  >
                    {confirmingReceipt ? "กำลังยืนยัน..." : receiptStageBtnLabel}
                  </button>
                  <button
                    onClick={() => setCancelTarget("claims")}
                    disabled={confirmingReceipt || cancellingHandover}
                    style={styles.rejectMatchBtn}
                  >
                    ย้อนไปตามหาใหม่
                  </button>
                </div>
              )}

              {/* ส่วนหัวข้อรายละเอียด */}
              <div style={styles.sectionHeader}>
                <Info size={18} style={{ color: '#F97316' }} />
                <span style={styles.sectionTitleText}>รายละเอียด</span>
              </div>

              <div style={styles.detailsContentBox}>
                {post.description || "ไม่มีรายละเอียดเพิ่มเติม"}
              </div>

              {/* ส่วนหัวข้อผู้ประกาศ */}
              <div style={styles.sectionHeader}>
                <User size={18} style={{ color: '#F97316' }} />
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

                  <div style={{ ...styles.reporterCard, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
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

              {/* กันแถบปุ่มลอยด้านล่างบังเนื้อหาท้ายหน้า */}
              {showClaimButton && !claimed && <div className="h-16" aria-hidden="true" />}

              </div>

              {/* แถบปุ่มอ้างสิทธิ์ลอยด้านล่างจอ (เฉพาะคนที่ไม่ใช่เจ้าของโพสต์ — เงื่อนไขเดิม showClaimButton) */}
              {showClaimButton && !claimed && (
                <div className="fixed z-40 bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[600px] flex items-center gap-3 bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.25)] px-3.5 py-2.5">
                  <p className="flex-1 min-w-0 text-xs sm:text-sm text-gray-600 leading-snug">
                    {post.type === "lost"
                      ? "พบสิ่งของนี้หรือไม่? แจ้งเจ้าของประกาศเพื่อให้ติดต่อกลับ"
                      : "เป็นสิ่งของของคุณหรือไม่? แจ้งผู้ประกาศเพื่อให้ติดต่อกลับ"}
                  </p>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="flex-shrink-0 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
                  >
                    {claiming ? "กำลังส่ง..." : post.type === "lost" ? "เจอของชิ้นนี้แล้ว" : "ใช่ของฉัน"}
                  </button>
                </div>
              )}

            </div>
          )}

          {/* โพสต์ที่คล้ายกัน (ซ่อนเองถ้าไม่มีผล) */}
          {!loading && !error && post && <SimilarPosts itemId={post.id} />}

        </div>
      </div>

      {/* modal แก้ไขประกาศของตัวเอง */}
      <EditPostModal
        open={showEditModal}
        initial={{ title: post?.title || "", description: post?.description || "", location: post?.location || "" }}
        saving={savingEdit}
        error={editError}
        onSave={handleSaveEdit}
        onCancel={() => setShowEditModal(false)}
      />

      {/* modal ยืนยันก่อนลบประกาศ (ย้อนกลับไม่ได้) */}
      <ResultModal
        open={showDeleteConfirm}
        success={false}
        title="ลบประกาศนี้?"
        message="ประกาศและรูปทั้งหมดจะถูกลบถาวร ย้อนกลับไม่ได้ ถ้ามีแมทช์หรือคนแจ้งว่าเจอของค้างอยู่ ระบบจะยกเลิกและแจ้งเขาให้"
        actionLabel={deleting ? "กำลังลบ..." : "ใช่ ลบประกาศ"}
        onAction={handleDeletePost}
        confirmLabel="ยกเลิก"
        onConfirm={() => setShowDeleteConfirm(false)}
      />

      {/* modal ยืนยันก่อนเจ้าของปิดประกาศเอง */}
      <ResultModal
        open={showCloseConfirm}
        success={true}
        title={`${closeLabel}ใช่ไหม?`}
        message="ประกาศนี้จะถูกปิดและไม่แสดงในหน้าประกาศทั้งหมด โดยจะแสดงในหมวด “พบเจ้าของแล้ว” ในโปรไฟล์ หากมีการจับคู่ที่ค้างอยู่จะถูกยกเลิก"
        actionLabel={closingPost ? "กำลังปิด..." : "ใช่ ปิดประกาศ"}
        onAction={handleClosePost}
        confirmLabel="ยกเลิก"
        onConfirm={() => setShowCloseConfirm(false)}
      />

      {/* modal ยืนยัน "ไม่ใช่ของฉัน" ก่อนยิง reject จริง */}
      <ResultModal
        open={showRejectConfirm}
        success={false}
        title="ยืนยันว่าไม่ใช่สิ่งของของคุณ?"
        message="ระบบจะยกเลิกการจับคู่นี้ ประกาศของทั้งสองฝ่ายยังคงเปิดอยู่ตามปกติ"
        actionLabel={rejectingPost ? "กำลังดำเนินการ..." : "ใช่ ไม่ใช่ของฉัน"}
        onAction={async () => {
          await handleRejectOnPost();
          setShowRejectConfirm(false);
        }}
        confirmLabel="ยกเลิก"
        onConfirm={() => setShowRejectConfirm(false)}
      />

      {/* modal ยืนยัน "ย้อนไปตามหาใหม่" ก่อนยกเลิกการส่งมอบจริง */}
      <ResultModal
        open={cancelTarget !== null}
        success={false}
        title="ไม่ใช่ของชิ้นนี้ใช่ไหม?"
        message="ระบบจะยกเลิกการส่งมอบนี้ ประกาศทั้งสองฝั่งยังเปิดอยู่ตามเดิม และจะแจ้งอีกฝ่ายให้ทราบ"
        actionLabel={cancellingHandover ? "กำลังดำเนินการ..." : "ใช่ ย้อนไปตามหาใหม่"}
        onAction={handleCancelHandover}
        confirmLabel="ไม่ใช่"
        onConfirm={() => setCancelTarget(null)}
      />

      {/* modal แจ้งผลลัพธ์การกระทำต่างๆ ในหน้านี้ (แทน alert() ของเบราว์เซอร์) */}
      <ResultModal
        open={!!resultModal}
        success={resultModal?.success ?? true}
        title={resultModal?.title || ""}
        message={resultModal?.message || ""}
        confirmLabel="ตกลง"
        onConfirm={() => {
          const shouldGoToAllPosts = resultModal?.goToAllPosts;
          setResultModal(null);
          if (shouldGoToAllPosts) navigate("/allposts");
        }}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: 'clamp(12px, 4vw, 30px) 10px', display: 'flex', justifyContent: 'center', boxSizing: 'border-box' },
  wrapper: { width: '100%', maxWidth: '1040px', display: 'flex', flexDirection: 'column' as const, gap: '10px' },

  backBtn: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF', border: '1px solid #EADFCB', color: '#4A5568', fontSize: '12px', cursor: 'pointer', width: 'fit-content', padding: '6px 14px', borderRadius: '999px', textDecoration: 'none', boxShadow: '0 2px 6px rgba(120,80,20,0.08)' },


  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 'clamp(14px, 4vw, 28px)', border: '1px solid #EADFCB', padding: 0, overflow: 'clip', gap: 0, boxShadow: '0 14px 40px -12px rgba(120,80,20,0.18)', boxSizing: 'border-box' },
  cardBody: { padding: 'clamp(14px, 4vw, 36px)', display: 'flex', flexDirection: 'column' as const, gap: '10px', boxSizing: 'border-box' },

  headerRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  itemTitle: { fontSize: 'clamp(18px, 5vw, 28px)', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.25, color: '#1A202C', margin: 0 },

  statusBadge: { color: '#FFFFFF', fontSize: 'clamp(10px, 2.8vw, 12px)', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', display: 'inline-block' },

  timeBadge: { display: 'flex', alignItems: 'center', gap: '5px', color: '#4A5568', fontSize: 'clamp(11px, 3vw, 13px)', backgroundColor: '#E2E8F0', width: 'fit-content', padding: '3px 10px', borderRadius: '20px', fontWeight: '500' },
  locationRow: { display: 'flex', alignItems: 'center', gap: '5px', color: '#4A5568' },
  locationText: { fontSize: 'clamp(12px, 3.2vw, 14px)', fontWeight: '500' },

  imageGrid: { display: 'flex', gap: '8px', width: '100%', marginTop: '4px', marginBottom: '4px' },
  mainImageWrapper: { borderRadius: '4px', overflow: 'hidden', border: '1px solid #000000', display: 'inline-block' },
  gridImage: { display: 'block', backgroundColor: '#F7FAFC' },

  matchBox: { backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', padding: 'clamp(12px, 3.5vw, 16px) clamp(12px, 4vw, 18px)', display: 'flex', flexDirection: 'column' as const, gap: '10px' },
  matchBoxText: { display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: 'clamp(12px, 3.2vw, 13.5px)', color: '#166534', lineHeight: '1.5' },
  confirmMatchBtn: { alignSelf: 'flex-start', backgroundColor: '#16A34A', color: '#FFFFFF', border: 'none', padding: 'clamp(8px, 2.5vw, 10px) clamp(14px, 4vw, 20px)', borderRadius: '10px', fontSize: 'clamp(12px, 3.2vw, 14px)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  rejectMatchBtn: { alignSelf: 'flex-start', backgroundColor: '#FFFFFF', color: '#E53E3E', border: '1px solid #FEB2B2', padding: 'clamp(8px, 2.5vw, 10px) clamp(14px, 4vw, 20px)', borderRadius: '10px', fontSize: 'clamp(12px, 3.2vw, 14px)', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },

  sectionHeader: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' },
  sectionTitleText: { fontSize: 'clamp(12px, 3.2vw, 14px)', fontWeight: 'bold', color: '#1A202C' },

  detailsContentBox: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: 'clamp(10px, 3vw, 16px) clamp(12px, 3.5vw, 20px)', borderRadius: '14px', fontSize: 'clamp(12px, 3.2vw, 14px)', color: '#1A202C', lineHeight: '1.6', whiteSpace: 'pre-line' as const },

  reporterCard: { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: 'clamp(10px, 3vw, 16px)', borderRadius: '14px', display: 'flex', gap: '10px', alignItems: 'center', width: '100%', boxSizing: 'border-box' },
  avatarCircle: { width: 'clamp(36px, 9vw, 48px)', height: 'clamp(36px, 9vw, 48px)', borderRadius: '50%', backgroundColor: '#A0AEC0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarInitial: { color: '#FFFFFF', fontSize: 'clamp(15px, 4vw, 20px)', fontWeight: 'bold', userSelect: 'none' as const },
  reporterInfo: { display: 'flex', flexDirection: 'column' as const, gap: '2px' },
  reporterNameText: { fontSize: 'clamp(12px, 3.2vw, 14px)', fontWeight: 'bold', color: '#1A202C' },
  reporterPhoneText: { fontSize: 'clamp(11px, 3vw, 13px)', color: '#718096' },
  createdAtText: { fontSize: 'clamp(10px, 2.8vw, 11px)', color: '#A0AEC0', marginTop: '2px' }
};