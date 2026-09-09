import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	Home,
	Image as ImageIcon,
	FileText,
	Bell,
	User,
	Camera,
	Info,
	Menu,
	X
} from 'lucide-react';
import { reportItem } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { LOCATIONS } from '../utils/locations';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/format';
import { hasContactInfo } from '../utils/profilecontact';
import ResultModal from '../components/ResultModal';

export default function ReportFound() {
	const navigate = useNavigate();
	const [itemName, setItemName] = useState<string>('');
	const [description, setDescription] = useState<string>('');
	const [location, setLocation] = useState<string>('');
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement>(null);
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
	const [loading, setLoading] = useState(false);
	const [resultModal, setResultModal] = useState<{ success: boolean; message: string; matchedItemId?: string | null; goToProfile?: boolean } | null>(null);

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const file = e.target.files[0];
			setSelectedImage(file);
			setImagePreview(URL.createObjectURL(file));
		}
	};

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);

		try {
			const { data: { user } } = await supabase.auth.getUser();

			// บังคับให้ต้องมีช่องทางติดต่ออย่างน้อย 1 อย่างในโปรไฟล์ก่อนถึงจะลงประกาศได้
			// เพราะถ้าไม่มีเลย ต่อให้แมทช์กันได้ อีกฝั่งก็ติดต่อกลับไม่ได้อยู่ดี
			if (user) {
				const ok = await hasContactInfo(user.id);
				if (!ok) {
					setResultModal({
						success: false,
						message: "คุณยังไม่ได้เพิ่มช่องทางติดต่อในโปรไฟล์เลย (เบอร์โทร/Line/Facebook/Instagram) กรุณาเพิ่มอย่างน้อย 1 ช่องทางก่อนลงประกาศ เพื่อให้อีกฝั่งติดต่อกลับได้",
						goToProfile: true,
					});
					setLoading(false);
					return;
				}
			}

			const formData = new FormData();
			formData.append('item_type', 'found');
			formData.append('item_name', itemName);
			formData.append('details', description);
			formData.append('location', location);
			if (user) formData.append('user_id', user.id);
			if (selectedImage) formData.append('image', selectedImage);

			const result = await reportItem(formData);
			setResultModal({
				success: true,
				message: result.message || "ระบบบันทึกประกาศและเริ่มกระบวนการค้นหาเจ้าของเรียบร้อยแล้ว",
				matchedItemId: result.matched_item_id || null,
			});
		} catch (err: any) {
			console.error(err);
			// ใช้ข้อความ error จริงจาก backend ถ้ามี (เช่น "กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขเท่านั้น")
			// ไม่มีก็ fallback เป็นข้อความทั่วไป
			setResultModal({
				success: false,
				message: err?.message || "เกิดข้อผิดพลาด ไม่สามารถส่งประกาศได้ กรุณาลองใหม่อีกครั้ง",
			});
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-cream font-kanit">

			{/* ================= Navbar ================= */}
			<nav className="bg-white shadow-sm border-b border-gray-300 sticky top-0 z-50">
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
							<ImageIcon size={20} />
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

			{/* ================= Main Form Container ================= */}
			<div style={styles.container}>
				<div style={styles.wrapper}>

					<form onSubmit={handleSubmit} style={styles.mainCard}>

						{/* หัวข้อด้านบนสุด */}
						<h1 style={styles.mainTitle}>ประกาศพบสิ่งของ</h1>
						<p style={styles.mainSubtitle}>กรอกรายละเอียดเพื่อประกาศตามหาเจ้าของของชิ้นนี้</p>

						{/* ช่องชื่อสิ่งของ (กรอกเองตรงๆ ไม่ให้ AI ต้องเดา/ตีความจากรายละเอียดอีกต่อไป) */}
						<div style={styles.inputBlock}>
							<input
								type="text"
								placeholder="ชื่อสิ่งของที่พบ เช่น กระเป๋าสตางค์หนังสีดำ, กุญแจรถ"
								value={itemName}
								onChange={(e) => setItemName(e.target.value)}
								style={{ ...styles.textareaWhite, border: 'none' }}
								required
							/>
						</div>

						{/* กล่องข้อความขนาดใหญ่พิมพ์รายละเอียด */}
						<div style={styles.inputBlock}>
							<textarea
								placeholder="ระบุสถานที่ที่พบ ลักษณะสิ่งของ สี หรือรายละเอียดสำคัญอื่นๆ..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								style={styles.textareaWhite}
								rows={6}
								required
							/>
						</div>

						{/* ช่องเลือกสถานที่ที่พบ */}
						<div style={styles.inputBlock}>
							<input
								type="text"
								list="location-suggestions"
								placeholder="พิมพ์สถานที่ที่พบสิ่งของ เช่น คณะวิศวกรรมศาสตร์, หอสมุด"
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								style={{ ...styles.textareaWhite, border: 'none' }}
								required
							/>
							<datalist id="location-suggestions">
								{LOCATIONS.map((loc) => (
									<option key={loc.value} value={loc.value} />
								))}
							</datalist>
						</div>

						{/* พรีวิวรูปที่แนบ (ถ้ามี) */}
						{imagePreview && (
							<div style={styles.imagePreviewBlock}>
								<img src={imagePreview} alt="Preview" style={styles.imagePreview} />
								<button
									type="button"
									onClick={() => { setSelectedImage(null); setImagePreview(null); }}
									style={styles.removeImageBtn}
								>
									ลบรูป
								</button>
							</div>
						)}

						<input
							type="file"
							accept="image/*"
							ref={fileInputRef}
							onChange={handleImageChange}
							style={{ display: 'none' }}
						/>

						<div style={styles.divider}></div>

						{/* แถบเครื่องมือแนบรูป */}
						<div style={styles.toolsContainer}>
							<div style={styles.toolsRow}>
								<div style={styles.toolItem} onClick={handleUploadClick}>
									<Camera size={18} style={styles.toolIconBlue} />
									<span style={styles.toolTextBlue}>ถ่าย/แนบรูป</span>
								</div>

								<div style={styles.toolItem} onClick={handleUploadClick}>
									<ImageIcon size={18} style={styles.toolIconOrange} />
									<span style={styles.toolTextOrange}>อัปโหลดรูปภาพ</span>
								</div>
							</div>

							{/* แจ้งว่าข้อมูลติดต่อดึงจากโปรไฟล์อัตโนมัติ ไม่ต้องกรอกซ้ำทุกครั้ง */}
							<div style={styles.infoBanner}>
								<Info size={14} style={{ color: '#3182CE', flexShrink: 0, marginTop: '1px' }} />
								<span>
									ระบบจะใช้เบอร์โทร/Line/Facebook จาก
									<Link to="/editprofile" style={{ color: '#3182CE', fontWeight: 600, textDecoration: 'underline', margin: '0 4px' }}>
										โปรไฟล์ของคุณ
									</Link>
									ให้อีกฝั่งติดต่อกลับ กรุณาตรวจสอบให้เป็นข้อมูลล่าสุดก่อนส่งประกาศ
								</span>
							</div>
						</div>

						<div style={styles.divider}></div>

						{/* ปุ่มส่งฟอร์มประกาศ */}
						<button type="submit" style={styles.submitBtn} disabled={loading}>
							{loading ? 'กำลังบันทึก...' : 'ส่งข้อมูลเพื่อประกาศตามหาเจ้าของ'}
						</button>

						{/* หมายเหตุแจ้งเตือนผู้ใช้งานตัวเล็กด้านล่าง */}
						<div style={styles.noteBox}>
							<p style={styles.noteItem}>* กรุณาแนบรูปภาพสิ่งของที่พบ</p>
							<p style={styles.noteItem}>* กรุณาระบุรายละเอียดลักษณะเด่นชัดเจน</p>
							<p style={styles.noteItem}>* กรุณาระบุอาคาร คณะ หรือจุดพิกัดในมหาวิทยาลัย</p>
						</div>

					</form>

					{/* ข้อความชี้แจงด้านล่างการ์ด */}
					<p style={styles.aiFooterText}>ระบบจะทำการวิเคราะห์ข้อมูลและจับคู่ส่งสัญญานไปหาผู้ที่ลงประกาศของหายทันที</p>

					{/* ปุ่มกดยกเลิก */}
					<Link to="/ " style={styles.backLinkBtn}>ยกเลิก</Link>

				</div>
			</div>

			<ResultModal
				open={!!resultModal}
				success={resultModal?.success ?? true}
				title={
					resultModal?.goToProfile
						? "ยังไม่มีช่องทางติดต่อ"
						: resultModal?.success
							? (resultModal?.matchedItemId ? "เจอสิ่งของที่ตรงกันแล้ว! 🎉" : "บันทึกประกาศสำเร็จ")
							: "เกิดข้อผิดพลาด"
				}
				message={resultModal?.message || ""}
				actionLabel={resultModal?.matchedItemId ? "ดูรายละเอียด" : undefined}
				onAction={
					resultModal?.matchedItemId
						? () => navigate(`/postdetail/${resultModal.matchedItemId}`)
						: undefined
				}
				confirmLabel={resultModal?.goToProfile ? "ไปที่โปรไฟล์" : resultModal?.matchedItemId ? "ปิด" : "ตกลง"}
				onConfirm={() => {
					const wasSuccess = resultModal?.success;
					const shouldGoToProfile = resultModal?.goToProfile;
					setResultModal(null);
					if (shouldGoToProfile) navigate('/editprofile');
					else if (wasSuccess) navigate('/allposts');
				}}
			/>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: { padding: 'clamp(20px, 6vw, 40px) clamp(10px, 3vw, 15px)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' },
	wrapper: { width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' },
	mainCard: { backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: 'clamp(20px, 6vw, 36px) clamp(16px, 5vw, 28px)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box' },
	mainTitle: { fontSize: 'clamp(17px, 4.5vw, 22px)', fontWeight: 'bold', color: '#1A202C', margin: '0 0 6px 0', textAlign: 'center' },
	mainSubtitle: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#718096', margin: '0 0 clamp(16px, 5vw, 24px) 0', textAlign: 'center' },
	inputBlock: { width: '100%', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' },
	textareaWhite: { width: '100%', padding: 'clamp(10px, 3.5vw, 16px)', backgroundColor: '#FFFFFF', border: 'none', fontSize: 'clamp(12px, 3vw, 14px)', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568', lineHeight: '1.6' },

	imagePreviewBlock: { position: 'relative', width: 'clamp(100px, 30vw, 140px)', height: 'clamp(100px, 30vw, 140px)', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px', border: '1px solid #E2E8F0' },
	imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
	removeImageBtn: { position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(229, 62, 62, 0.85)', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' },

	divider: { height: '1px', backgroundColor: '#EDF2F7', margin: '18px 0' },

	toolsContainer: { width: '100%', padding: '0 4px' },
	toolsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' },
	infoBanner: { display: 'flex', alignItems: 'flex-start', gap: '8px', backgroundColor: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: '10px', padding: 'clamp(8px, 2.5vw, 10px) clamp(10px, 3vw, 12px)', marginTop: '14px', fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#2C5282', lineHeight: '1.6' },
	toolItem: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 4px' },

	toolIconBlue: { color: '#3182CE' },
	toolTextBlue: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#3182CE', fontWeight: '500' },

	toolIconOrange: { color: '#ED8936' },
	toolTextOrange: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#ED8936', fontWeight: '500' },

	toolIconDarkOrange: { color: '#DD6B20' },
	toolTextDarkOrange: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#DD6B20', fontWeight: '500' },

	toolIconGreen: { color: '#38A169' },
	toolTextGreen: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#38A169', fontWeight: '500' },

	toolIconActive: { color: '#38A169' },
	toolTextActive: { fontSize: '14px', color: '#38A169', fontWeight: 'semibold' },

	socialFormBlock: { marginTop: '14px', padding: '18px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EDF2F7', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' as const, gap: '14px' },
	inputFieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
	innerLabel: { fontSize: '12px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	innerLabelRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	socialInput: { width: '100%', padding: '11px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13.5px', color: '#2D3748', outline: 'none', backgroundColor: '#F9FAFB', boxSizing: 'border-box' as const, transition: 'border-color 0.15s, background-color 0.15s', fontFamily: 'inherit' },

	submitBtn: { width: '100%', backgroundColor: '#3182CE', color: '#FFFFFF', border: 'none', padding: 'clamp(10px, 3vw, 14px) 0', borderRadius: '12px', fontSize: 'clamp(12px, 3.2vw, 15px)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' },

	noteBox: { textAlign: 'left', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' },
	noteItem: { fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#718096', margin: 0 },

	aiFooterText: { fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#A0AEC0', textAlign: 'center', margin: '6px 0 0 0', padding: '0 10px', lineHeight: '1.5' },
	backLinkBtn: { backgroundColor: '#EDF2F7', color: '#4A5568', textDecoration: 'none', padding: 'clamp(9px, 2.8vw, 12px) 0', borderRadius: '12px', fontWeight: '600', fontSize: 'clamp(11px, 3vw, 14px)', marginTop: '6px', textAlign: 'center', display: 'block', border: '1px solid #E2E8F0' }
};