import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	Home,
	Image as ImageIcon,
	FileText,
	Bell,
	User,
	Camera,
	Phone,
	Share2,
	Link2,
	MessageCircle,
	Menu,
	X
} from 'lucide-react';
import { reportItem } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { LOCATIONS } from '../utils/locations';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime } from '../utils/format';
import ResultModal from '../components/ResultModal';

export default function ReportFound() {
	const navigate = useNavigate();
	const [description, setDescription] = useState<string>('');
	const [location, setLocation] = useState<string>('');
	const [showSocialFields, setShowSocialFields] = useState<boolean>(false);
	const [showPhoneField, setShowPhoneField] = useState<boolean>(false);
	const [facebookUrl, setFacebookUrl] = useState<string>('');
	const [lineId, setLineId] = useState<string>('');
	const [phone, setPhone] = useState<string>('');
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const fileInputRef = React.useRef<HTMLInputElement>(null);
	const [showNoti, setShowNoti] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();
	const [loading, setLoading] = useState(false);
	const [resultModal, setResultModal] = useState<{ success: boolean; message: string } | null>(null);

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

			const formData = new FormData();
			formData.append('item_type', 'found');
			formData.append('item_name', ''); // ไม่มีช่องชื่อแยก ให้ agent สรุปเองจาก details
			formData.append('details', description);
			formData.append('phone', phone);
			formData.append('location', location);
			if (user) formData.append('user_id', user.id);
			if (selectedImage) formData.append('image', selectedImage);

			const result = await reportItem(formData);
			setResultModal({
				success: true,
				message: result.message || "ระบบบันทึกประกาศและเริ่มกระบวนการค้นหาเจ้าของเรียบร้อยแล้ว",
			});
		} catch (err) {
			console.error(err);
			setResultModal({
				success: false,
				message: "เกิดข้อผิดพลาด ไม่สามารถส่งประกาศได้ กรุณาลองใหม่อีกครั้ง",
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
						<Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50">
							<Home size={20} />
							หน้าแรก
						</Link>
						<Link to="/searchbyimage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50">
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

			{/* ================= Main Form Container ================= */}
			<div style={styles.container}>
				<div style={styles.wrapper}>

					<form onSubmit={handleSubmit} style={styles.mainCard}>

						{/* หัวข้อด้านบนสุด */}
						<h1 style={styles.mainTitle}>ประกาศพบสิ่งของ</h1>
						<p style={styles.mainSubtitle}>กรอกรายละเอียดเพื่อประกาศตามหาเจ้าของของชิ้นนี้</p>

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

						{/* แถบเครื่องมือไอคอนอัปโหลดข้อมูล */}
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

								<div style={styles.toolItem} onClick={() => setShowPhoneField(!showPhoneField)}>
									<Phone size={18} style={showPhoneField ? styles.toolIconActive : styles.toolIconDarkOrange} />
									<span style={showPhoneField ? styles.toolTextActive : styles.toolTextDarkOrange}>เบอร์โทรติดต่อ</span>
								</div>

								<div style={styles.toolItem} onClick={() => setShowSocialFields(!showSocialFields)}>
									<Share2 size={18} style={showSocialFields ? styles.toolIconActive : styles.toolIconGreen} />
									<span style={showSocialFields ? styles.toolTextActive : styles.toolTextGreen}>ช่องทางอื่น</span>
								</div>
							</div>

							{showPhoneField && (
								<div style={{ ...styles.socialFormBlock, borderLeft: '3px solid #DD6B20' }}>
									<div style={styles.inputFieldGroup}>
										<label style={styles.innerLabelRow}>
											<Phone size={13} style={{ color: '#DD6B20' }} />
											เบอร์โทรติดต่อ
										</label>
										<input
											type="text"
											placeholder="เบอร์โทรศัพท์ที่สามารถติดต่อได้"
											value={phone}
											onChange={(e) => setPhone(e.target.value)}
											style={styles.socialInput}
										/>
									</div>
								</div>
							)}

							{showSocialFields && (
								<div style={{ ...styles.socialFormBlock, borderLeft: '3px solid #38A169' }}>
									<div style={styles.inputFieldGroup}>
										<label style={styles.innerLabelRow}>
											<Link2 size={13} style={{ color: '#3B5998' }} />
											Facebook
										</label>
										<input
											type="text"
											placeholder="Facebook (ไม่บังคับ)"
											value={facebookUrl}
											onChange={(e) => setFacebookUrl(e.target.value)}
											style={styles.socialInput}
										/>
									</div>
									<div style={styles.inputFieldGroup}>
										<label style={styles.innerLabelRow}>
											<MessageCircle size={13} style={{ color: '#06C755' }} />
											Line ID
										</label>
										<input
											type="text"
											placeholder="ไอดีไลน์ (ไม่บังคับ)"
											value={lineId}
											onChange={(e) => setLineId(e.target.value)}
											style={styles.socialInput}
										/>
									</div>
								</div>
							)}
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
				title={resultModal?.success ? "บันทึกประกาศสำเร็จ" : "เกิดข้อผิดพลาด"}
				message={resultModal?.message || ""}
				onConfirm={() => {
					const wasSuccess = resultModal?.success;
					setResultModal(null);
					if (wasSuccess) navigate('/allposts');
				}}
			/>
		</div>
	);
}

const styles: Record<string, React.CSSProperties> = {
	container: { padding: '40px 15px', display: 'flex', justifyContent: 'center', alignItems: 'center', boxSizing: 'border-box' },
	wrapper: { width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' },
	mainCard: { backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '36px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', boxSizing: 'border-box' },
	mainTitle: { fontSize: '22px', fontWeight: 'bold', color: '#1A202C', margin: '0 0 6px 0', textAlign: 'center' },
	mainSubtitle: { fontSize: '14px', color: '#718096', margin: '0 0 24px 0', textAlign: 'center' },
	inputBlock: { width: '100%', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' },
	textareaWhite: { width: '100%', padding: '16px', backgroundColor: '#FFFFFF', border: 'none', fontSize: '14px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#4A5568', lineHeight: '1.6' },

	imagePreviewBlock: { position: 'relative', width: '140px', height: '140px', borderRadius: '12px', overflow: 'hidden', marginBottom: '10px', border: '1px solid #E2E8F0' },
	imagePreview: { width: '100%', height: '100%', objectFit: 'cover' },
	removeImageBtn: { position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(229, 62, 62, 0.85)', color: '#FFFFFF', border: 'none', borderRadius: '6px', padding: '2px 6px', fontSize: '11px', cursor: 'pointer' },

	divider: { height: '1px', backgroundColor: '#EDF2F7', margin: '18px 0' },

	toolsContainer: { width: '100%', padding: '0 4px' },
	toolsRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '12px' },
	toolItem: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '6px 4px' },

	toolIconBlue: { color: '#3182CE' },
	toolTextBlue: { fontSize: '14px', color: '#3182CE', fontWeight: '500' },

	toolIconOrange: { color: '#ED8936' },
	toolTextOrange: { fontSize: '14px', color: '#ED8936', fontWeight: '500' },

	toolIconDarkOrange: { color: '#DD6B20' },
	toolTextDarkOrange: { fontSize: '14px', color: '#DD6B20', fontWeight: '500' },

	toolIconGreen: { color: '#38A169' },
	toolTextGreen: { fontSize: '14px', color: '#38A169', fontWeight: '500' },

	toolIconActive: { color: '#38A169' },
	toolTextActive: { fontSize: '14px', color: '#38A169', fontWeight: 'semibold' },

	socialFormBlock: { marginTop: '14px', padding: '18px', backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #EDF2F7', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' as const, gap: '14px' },
	inputFieldGroup: { display: 'flex', flexDirection: 'column' as const, gap: '6px' },
	innerLabel: { fontSize: '12px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	innerLabelRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: '600', color: '#4A5568', paddingLeft: '2px' },
	socialInput: { width: '100%', padding: '11px 14px', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '13.5px', color: '#2D3748', outline: 'none', backgroundColor: '#F9FAFB', boxSizing: 'border-box' as const, transition: 'border-color 0.15s, background-color 0.15s', fontFamily: 'inherit' },

	submitBtn: { width: '100%', backgroundColor: '#3182CE', color: '#FFFFFF', border: 'none', padding: '14px 0', borderRadius: '12px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' },

	noteBox: { textAlign: 'left', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px' },
	noteItem: { fontSize: '12px', color: '#718096', margin: 0 },

	aiFooterText: { fontSize: '12px', color: '#A0AEC0', textAlign: 'center', margin: '6px 0 0 0', padding: '0 10px', lineHeight: '1.5' },
	backLinkBtn: { backgroundColor: '#EDF2F7', color: '#4A5568', textDecoration: 'none', padding: '12px 0', borderRadius: '12px', fontWeight: '600', fontSize: '14px', marginTop: '6px', textAlign: 'center', display: 'block', border: '1px solid #E2E8F0' }
};