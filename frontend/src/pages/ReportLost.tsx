import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	Home,
	Image as ImageIcon,
	FileText,
	User,
	Camera,
	Info,
	Menu,
	X
} from 'lucide-react';
import { reportItem } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { LOCATIONS } from '../utils/locations';
import NotificationBell from '../components/NotificationBell';
import { hasContactInfo } from '../utils/profilecontact';
import ResultModal from '../components/ResultModal';
import Spinner from '../components/Spinner';
import LoadingOverlay from '../components/LoadingOverlay';
import AiIdentify from '../components/AiIdentify';

export default function ReportLost() {
	const navigate = useNavigate();
	const [itemName, setItemName] = useState<string>('');
	const [details, setDetails] = useState<string>('');
	const [location, setLocation] = useState<string>('');
	// แนบได้หลายรูป (รูปแรก = รูปปกที่โชว์ในการ์ด) เก็บไฟล์คู่กับ URL พรีวิวของแต่ละรูป
	const MAX_IMAGES = 5;
	const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
	const fileInputRef = React.useRef<HTMLInputElement>(null);   // เลือกรูปจากเครื่อง (เลือกหลายรูปได้)
	const cameraInputRef = React.useRef<HTMLInputElement>(null); // เปิดกล้องถ่ายทีละรูป (มือถือ)

	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [resultModal, setResultModal] = useState<{ success: boolean; message: string; matchedItemId?: string | null; goToProfile?: boolean } | null>(null);

	const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const picked = Array.from(e.target.files || []);
		e.target.value = ''; // ให้เลือกไฟล์เดิมซ้ำได้หลังลบออก
		if (picked.length === 0) return;

		const room = MAX_IMAGES - images.length;
		if (picked.length > room) {
			setResultModal({ success: false, message: `แนบรูปได้สูงสุด ${MAX_IMAGES} รูปต่อประกาศ` });
		}
		const added = picked.slice(0, Math.max(room, 0)).map((file) => ({ file, preview: URL.createObjectURL(file) }));
		if (added.length > 0) setImages((prev) => [...prev, ...added]);
	};

	const removeImage = (index: number) => {
		setImages((prev) => {
			URL.revokeObjectURL(prev[index].preview);
			return prev.filter((_, i) => i !== index);
		});
	};

	const handleUploadClick = () => {
		fileInputRef.current?.click();
	};

	const handleCameraClick = () => {
		cameraInputRef.current?.click();
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
			formData.append('item_type', 'lost');
			formData.append('item_name', itemName);
			formData.append('details', details);
			formData.append('location', location);
			if (user) formData.append('user_id', user.id);
			images.forEach(({ file }) => formData.append('images', file));

			const result = await reportItem(formData);
			setResultModal({
				success: true,
				message: result.message || "ระบบบันทึกประกาศและเริ่มกระบวนการตามหาเรียบร้อยแล้ว",
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

			{/* ================= Main Form Container ================= */}
			<div style={styles.container}>
				<div style={styles.wrapper}>

					<form onSubmit={handleSubmit} style={styles.mainCard}>

						{/* หัวข้อด้านบนสุด */}
						<h1 style={styles.mainTitle}>ประกาศแจ้งของหาย</h1>
						<p style={styles.mainSubtitle}>กรอกรายละเอียดเพื่อประกาศตามหาสิ่งของที่สูญหาย</p>

						{/* ช่องชื่อสิ่งของ (เฉพาะฝั่งของหาย เพราะเจ้าของรู้ชื่อของตัวเองชัดเจน) */}
						<div style={styles.inputBlock}>
							<input
								type="text"
								placeholder="ชื่อสิ่งของที่หาย เช่น โทรศัพท์มือถือ iPhone 15, กระเป๋าสตางค์หนังสีดำ"
								value={itemName}
								onChange={(e) => setItemName(e.target.value)}
								style={{ ...styles.textareaWhite, border: 'none' }}
								required
							/>
						</div>

						{/* ผู้ช่วย AI: ดูรูปแรกแล้วเสนอชื่อ/ยี่ห้อ/รุ่น (กดเอง ผู้ใช้ตัดสินใจเติมช่องชื่อเอง) */}
						<AiIdentify file={images[0]?.file ?? null} onApply={setItemName} />

						{/* กล่องข้อความขนาดใหญ่พิมพ์รายละเอียด */}
						<div style={styles.inputBlock}>
							<textarea
								placeholder="ระบุลักษณะ ตำหนิ สี หรือเวลาที่คาดว่าสิ่งของสูญหายล่าสุด..."
								value={details}
								onChange={(e) => setDetails(e.target.value)}
								style={styles.textareaWhite}
								rows={5}
							/>
						</div>

						{/* ช่องเลือกสถานที่ที่คาดว่าทำหาย */}
						<div style={styles.inputBlock}>
							<input
								type="text"
								list="location-suggestions"
								placeholder="พิมพ์สถานที่ที่คาดว่าทำหาย เช่น คณะวิศวกรรมศาสตร์, หอสมุด"
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
						{images.length > 0 && (
							<div style={styles.imagePreviewRow}>
								{images.map((img, i) => (
									<div key={img.preview} style={styles.imagePreviewBlock}>
										<img src={img.preview} alt={`รูปที่ ${i + 1}`} style={styles.imagePreview} />
										{i === 0 && <span style={styles.coverBadge}>รูปปก</span>}
										<button
											type="button"
											onClick={() => removeImage(i)}
											style={styles.removeImageBtn}
										>
											ลบรูป
										</button>
									</div>
								))}
							</div>
						)}

						<input
							type="file"
							accept="image/*"
							multiple
							ref={fileInputRef}
							onChange={handleImageChange}
							style={{ display: 'none' }}
						/>

						{/* ช่องสำหรับถ่ายรูป: capture="environment" ให้มือถือเปิดกล้องหลังทันที (บนคอมจะเป็นการเลือกไฟล์ปกติ) */}
						<input
							type="file"
							accept="image/*"
							capture="environment"
							ref={cameraInputRef}
							onChange={handleImageChange}
							style={{ display: 'none' }}
						/>

						<div style={styles.divider}></div>

						{/* แถบเครื่องมือแนบรูป */}
						<div style={styles.toolsContainer}>
							<div style={styles.toolsRow}>
								<div style={styles.toolItem} onClick={handleCameraClick}>
									<Camera size={18} style={styles.toolIconBlue} />
									<span style={styles.toolTextBlue}>ถ่ายรูป</span>
								</div>

								<div style={styles.toolItem} onClick={handleUploadClick}>
									<ImageIcon size={18} style={styles.toolIconOrange} />
									<span style={styles.toolTextOrange}>อัปโหลดรูปภาพ ({images.length}/{MAX_IMAGES})</span>
								</div>
							</div>

							{/* แจ้งว่าข้อมูลติดต่อดึงจากโปรไฟล์อัตโนมัติ ไม่ต้องกรอกซ้ำทุกครั้ง */}
							<div style={styles.infoBanner}>
								<Info size={14} style={{ color: '#0EA5E9', flexShrink: 0, marginTop: '1px' }} />
								<span>
									ระบบจะใช้เบอร์โทร/Line/Facebook จาก
									<Link to="/editprofile" style={{ color: '#0EA5E9', fontWeight: 600, textDecoration: 'underline', margin: '0 4px' }}>
										โปรไฟล์ของคุณ
									</Link>
									ให้อีกฝั่งติดต่อกลับ กรุณาตรวจสอบให้เป็นข้อมูลล่าสุดก่อนส่งประกาศ
								</span>
							</div>
						</div>

						<div style={styles.divider}></div>

						{/* ปุ่มส่งฟอร์มประกาศ */}
						<button type="submit" style={{ ...styles.submitBtn, ...(loading ? styles.submitBtnLoading : {}) }} disabled={loading}>
							{loading ? (<><Spinner size={16} />กำลังบันทึก...</>) : 'ยืนยันการลงประกาศตามหา'}
						</button>

						{/* หมายเหตุแจ้งเตือนผู้ใช้งานตัวเล็กด้านล่าง */}
						<div style={styles.noteBox}>
							<p style={styles.noteItem}>* กรุณาแนบรูปภาพสิ่งของที่หาย (ถ้ามี)</p>
							<p style={styles.noteItem}>* กรุณาระบุรายละเอียดลักษณะเด่นชัดเจน</p>
							<p style={styles.noteItem}>* กรุณาระบุอาคาร คณะ หรือจุดพิกัดในมหาวิทยาลัย</p>
						</div>

					</form>

					{/* ข้อความชี้แจงด้านล่างการ์ด */}
					<p style={styles.aiFooterText}>ระบบจะทำการวิเคราะห์ข้อมูลและจับคู่ส่งสัญญานไปหาผู้ที่พบสิ่งของนี้ทันที</p>

					{/* ปุ่มกดยกเลิก */}
					<Link to="/ " style={styles.backLinkBtn}>ยกเลิก</Link>

				</div>
			</div>

			<LoadingOverlay
				open={loading}
				messages={[
					"กำลังอัปโหลดข้อมูลและรูปภาพ...",
					"AI กำลังวิเคราะห์ประกาศของคุณ...",
					"กำลังค้นหาคู่ที่ตรงกัน...",
				]}
			/>

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

// 🎨 โครงสร้างเดียวกับ ReportFound.tsx (การ์ดโค้งมน + กล่อง textarea ใหญ่ + toolbar ไอคอน)
// ต่างกันแค่สีปุ่มหลัก/แถบเน้น เป็นโทนแดงแทนน้ำเงิน เพื่อให้แยกออกจากฝั่ง "ของที่พบ" ได้ง่าย
const styles: Record<string, React.CSSProperties> = {
	container: { padding: 'clamp(20px, 6vw, 40px) clamp(10px, 3vw, 15px)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' },
	wrapper: { width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' },
	mainCard: { backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: 'clamp(20px, 6vw, 36px) clamp(16px, 5vw, 28px)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box' },
	mainTitle: { fontSize: 'clamp(17px, 4.5vw, 22px)', fontWeight: 'bold', color: '#1A202C', margin: '0 0 6px 0', textAlign: 'center' },
	mainSubtitle: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#718096', margin: '0 0 clamp(16px, 5vw, 24px) 0', textAlign: 'center' },
	inputBlock: { width: '100%', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' },
	textareaWhite: { width: '100%', padding: 'clamp(10px, 3.5vw, 16px)', backgroundColor: '#FFFFFF', border: 'none', fontSize: 'clamp(12px, 3vw, 14px)', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568', lineHeight: '1.6' },

	imagePreviewBlock: { position: 'relative', width: 'clamp(100px, 30vw, 140px)', height: 'clamp(100px, 30vw, 140px)', borderRadius: '12px', overflow: 'hidden', border: '1px solid #E2E8F0' },
	imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
	imagePreviewRow: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' },
	coverBadge: { position: 'absolute', bottom: '4px', left: '4px', backgroundColor: 'rgba(0, 0, 0, 0.6)', color: '#FFFFFF', borderRadius: '6px', padding: '2px 6px', fontSize: '11px' },
	removeImageBtn: { position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(229, 62, 62, 0.85)', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' },

	divider: { height: '1px', backgroundColor: '#EDF2F7', margin: '18px 0' },

	toolsContainer: { width: '100%', padding: '0 4px' },
	toolsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' },
	infoBanner: { display: 'flex', alignItems: 'flex-start', gap: '8px', backgroundColor: '#EBF8FF', border: '1px solid #BEE3F8', borderRadius: '10px', padding: 'clamp(8px, 2.5vw, 10px) clamp(10px, 3vw, 12px)', marginTop: '14px', fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#2C5282', lineHeight: '1.6' },
	toolItem: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 4px' },

	toolIconBlue: { color: '#0EA5E9' },
	toolTextBlue: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#0EA5E9', fontWeight: '500' },

	toolIconOrange: { color: '#FF8820' },
	toolTextOrange: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#FF8820', fontWeight: '500' },

	toolIconDarkOrange: { color: '#E05F00' },
	toolTextDarkOrange: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#E05F00', fontWeight: '500' },

	toolIconGreen: { color: '#38A169' },
	toolTextGreen: { fontSize: 'clamp(11px, 3vw, 14px)', color: '#38A169', fontWeight: '500' },

	toolIconActive: { color: '#38A169' },
	toolTextActive: { fontSize: '14px', color: '#38A169', fontWeight: 'semibold' },

	socialFormBlock: { marginTop: '14px', padding: '18px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EDF2F7', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' as const, gap: '14px' },
	inputFieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
	innerLabel: { fontSize: '12px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	innerLabelRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	socialInput: { width: '100%', padding: '11px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13.5px', color: '#2D3748', outline: 'none', backgroundColor: '#F9FAFB', boxSizing: 'border-box' as const, transition: 'border-color 0.15s, background-color 0.15s', fontFamily: 'inherit' },

	// ปุ่มหลักโทนแดง (ต่างจาก ReportFound ที่เป็นน้ำเงิน) ให้แยกออกง่ายว่าเป็นฝั่ง "ของหาย"
	submitBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#FF3B3B', color: '#FFFFFF', border: 'none', padding: 'clamp(10px, 3vw, 14px) 0', borderRadius: '12px', fontSize: 'clamp(12px, 3.2vw, 15px)', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' },
	submitBtnLoading: { opacity: 0.75, cursor: 'not-allowed' },

	noteBox: { textAlign: 'left', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' },
	noteItem: { fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#718096', margin: 0 },

	aiFooterText: { fontSize: 'clamp(10.5px, 2.8vw, 12px)', color: '#A0AEC0', textAlign: 'center', margin: '6px 0 0 0', padding: '0 10px', lineHeight: '1.5' },
	backLinkBtn: { backgroundColor: '#EDF2F7', color: '#4A5568', textDecoration: 'none', padding: 'clamp(9px, 2.8vw, 12px) 0', borderRadius: '12px', fontWeight: '600', fontSize: 'clamp(11px, 3vw, 14px)', marginTop: '6px', textAlign: 'center', display: 'block', border: '1px solid #E2E8F0' }
};