import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	User,
	Phone,
	Save,
	LogOut,
	X,
	Home,
	Image,
	FileText,
	Bell,
	Camera,
	Trash2,
	Menu,
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { useNotifications } from "../hooks/useNotifications";
import { formatRelativeTime } from "../utils/format";

// สีคงที่ตามชื่อ (hash) — คนเดิมได้สีเดิมเสมอ ไม่ต้องเก็บสีลง DB เพิ่ม
const getAvatarColor = (name: string) => {
	if (!name) return "hsl(24, 90%, 50%)";

	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 60%, 45%)`;
};

// Avatar แบบ hybrid: มีรูป -> โชว์รูป, ไม่มีรูป -> ตัวอักษรแรก + สีจาก hash
const Avatar = ({
	name,
	avatarUrl,
	size = 36,
}: {
	name: string;
	avatarUrl?: string | null;
	size?: number;
}) => {
	if (avatarUrl) {
		return (
			<img
				src={avatarUrl}
				alt={name}
				className="rounded-full object-cover flex-shrink-0"
				style={{ width: size, height: size }}
			/>
		);
	}

	return (
		<div
			className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 select-none"
			style={{
				width: size,
				height: size,
				backgroundColor: getAvatarColor(name),
				fontSize: size * 0.4,
			}}
		>
			{name?.trim()?.charAt(0)?.toUpperCase() || <User size={size * 0.4} />}
		</div>
	);
};

const AVATAR_BUCKET = "avatars";

export default function EditProfile() {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [saving, setSaving] = useState<boolean>(false);
	const [uploadingAvatar, setUploadingAvatar] = useState<boolean>(false);
	const [userId, setUserId] = useState<string>("");

	const [firstName, setFirstName] = useState<string>("");
	const [lastName, setLastName] = useState<string>("");
	const [displayName, setDisplayName] = useState<string>("");
	const [phone, setPhone] = useState<string>("");
	const [lineId, setLineId] = useState<string>("");
	const [facebook, setFacebook] = useState<string>("");
	const [instagram, setInstagram] = useState<string>("");
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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
	const [showLogoutModal, setShowLogoutModal] = useState(false);


	// 1. ดึงข้อมูลผู้ใช้ปัจจุบันมาเติมในฟอร์ม
	useEffect(() => {
		async function loadUserData() {
			try {
				const { data: { user }, error: authError } = await supabase.auth.getUser();

				if (authError || !user) {
					navigate("/login");
					return;
				}

				setUserId(user.id);

				const { data, error: dbError } = await supabase
					.from("users")
					.select("*")
					.eq("id", user.id)
					.single();

				if (dbError) throw dbError;

				if (data) {
					setFirstName(data.first_name || "");
					setLastName(data.last_name || "");
					setDisplayName(data.display_name || "");
					setPhone(data.phone_number || "");
					setLineId(data.line_id || "");
					setFacebook(data.facebook_url || "");
					setInstagram(data.instagram_username || "");
					setAvatarUrl(data.avatar_url || null);
				}
			} catch (error: any) {
				console.error("Error loading user data:", error.message);
			} finally {
				setLoading(false);
			}
		}

		loadUserData();
	}, [navigate]);

	// 2. ฟังก์ชันอัปโหลดรูปโปรไฟล์
	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !userId) return;

		if (!file.type.startsWith("image/")) {
			alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			alert("ไฟล์รูปต้องมีขนาดไม่เกิน 5MB");
			return;
		}

		setUploadingAvatar(true);
		try {
			const fileExt = file.name.split(".").pop();
			const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from(AVATAR_BUCKET)
				.upload(filePath, file, { upsert: true });

			if (uploadError) throw uploadError;

			const { data: publicUrlData } = supabase.storage
				.from(AVATAR_BUCKET)
				.getPublicUrl(filePath);

			const newAvatarUrl = publicUrlData.publicUrl;

			const { error: updateError } = await supabase
				.from("users")
				.update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
				.eq("id", userId);

			if (updateError) throw updateError;

			setAvatarUrl(newAvatarUrl);
		} catch (error: any) {
			alert("อัปโหลดรูปไม่สำเร็จ: " + error.message);
		} finally {
			setUploadingAvatar(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	// 3. ฟังก์ชันลบรูปโปรไฟล์ (กลับไปใช้ตัวอักษรแทน)
	const handleRemoveAvatar = async () => {
		if (!userId || !avatarUrl) return;

		setUploadingAvatar(true);
		try {
			const { error } = await supabase
				.from("users")
				.update({ avatar_url: null, updated_at: new Date().toISOString() })
				.eq("id", userId);

			if (error) throw error;

			setAvatarUrl(null);
		} catch (error: any) {
			alert("ลบรูปไม่สำเร็จ: " + error.message);
		} finally {
			setUploadingAvatar(false);
		}
	};

	// 4. ฟังก์ชันอัปเดตข้อมูลลง Supabase
	const handleSaveAll = async (e: React.FormEvent | React.MouseEvent) => {
		e.preventDefault();
		if (!userId) return;

		setSaving(true);
		try {
			const { error } = await supabase
				.from("users")
				.update({
					first_name: firstName,
					last_name: lastName,
					display_name: displayName,
					phone_number: phone,
					line_id: lineId,
					facebook_url: facebook,
					instagram_username: instagram,
					updated_at: new Date().toISOString(),
				})
				.eq("id", userId);

			if (error) throw error;

			alert("บันทึกการเปลี่ยนแปลงทั้งหมดเรียบร้อยแล้ว");
			navigate("/profile");
		} catch (error: any) {
			// ดักจับ error เฉพาะจาก CHECK constraint ที่ตั้งไว้ใน Supabase (phone_number_digits_only)
			// แล้วแปลงเป็นข้อความไทยที่เข้าใจง่าย แทนที่จะโชว์ error ดิบๆ จากฐานข้อมูล
			if (error.message?.includes("phone_number_digits_only")) {
				alert("กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขเท่านั้น (ห้ามมีตัวอักษรหรือสัญลักษณ์ปน)");
			} else {
				alert("เกิดข้อผิดพลาดในการบันทึก: " + error.message);
			}
		} finally {
			setSaving(false);
		}
	};

	// 5. ฟังก์ชันออกจากระบบ
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
		<div className="min-h-screen bg-gray-50 font-kanit">
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
						<Link to="/profile" className="hover:text-orange-500 text-gray-600">
							<User />
						</Link>

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
			<div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">

				{loading ? (
					<div className="bg-white rounded-3xl shadow-sm p-8 text-center text-gray-500 animate-pulse">
						กำลังโหลดข้อมูลฟอร์ม...
					</div>
				) : (
					<form onSubmit={handleSaveAll} className="space-y-6">

						{/* ================= Main Card ================= */}
						<div className="bg-white rounded-3xl shadow-sm p-4 sm:p-5 md:p-8">

							{/* ---- Avatar Header ---- */}
							<div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-6 pb-4 sm:pb-6 border-b text-center sm:text-left">
								<div className="relative">
									<Avatar name={displayName} avatarUrl={avatarUrl} size={76} />

									<button
										type="button"
										onClick={() => fileInputRef.current?.click()}
										disabled={uploadingAvatar}
										className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white flex items-center justify-center shadow-sm border-2 border-white transition"
										aria-label="เปลี่ยนรูปโปรไฟล์"
									>
										<Camera size={11} className="sm:hidden" />
										<Camera size={14} className="hidden sm:block" />
									</button>

									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										className="hidden"
										onChange={handleAvatarChange}
									/>
								</div>

								<div className="flex-1">
									<h2 className="text-base sm:text-xl font-semibold text-gray-800">จัดการข้อมูลส่วนตัว</h2>
									<p className="text-gray-500 mt-1 text-xs sm:text-base">จัดการข้อมูลส่วนตัวของคุณ</p>

									<div className="flex items-center justify-center sm:justify-start gap-3 mt-3">
										<button
											type="button"
											onClick={() => fileInputRef.current?.click()}
											disabled={uploadingAvatar}
											className="text-xs font-semibold text-orange-500 hover:underline disabled:text-orange-300"
										>
											{uploadingAvatar ? "กำลังอัปโหลด..." : "เปลี่ยนรูปโปรไฟล์"}
										</button>

										{avatarUrl && (
											<button
												type="button"
												onClick={handleRemoveAvatar}
												disabled={uploadingAvatar}
												className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-red-500 transition disabled:opacity-50"
											>
												<Trash2 size={12} />
												ลบรูป
											</button>
										)}
									</div>
								</div>
							</div>

							{/* ---- 1. ข้อมูลพื้นฐาน ---- */}
							<div className="py-4 sm:py-6 border-b">
								<div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
									<User className="text-orange-500" size={16} />
									<h3 className="text-sm sm:text-lg font-semibold text-gray-800">ข้อมูลพื้นฐาน</h3>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">ชื่อ</label>
										<input
											type="text"
											value={firstName}
											onChange={(e) => setFirstName(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>

									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">นามสกุล</label>
										<input
											type="text"
											value={lastName}
											onChange={(e) => setLastName(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>
								</div>

								<div className="mt-3 sm:mt-4">
									<label className="block text-xs sm:text-sm text-gray-500 mb-1">ชื่อที่แสดง</label>
									<input
										type="text"
										required
										value={displayName}
										onChange={(e) => setDisplayName(e.target.value)}
										className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
									/>
									<p className="text-[10px] sm:text-xs text-gray-400 mt-1.5">ชื่อนี้จะแสดงในประกาศและโปรไฟล์ของคุณ</p>
								</div>
							</div>

							{/* ---- 2. ข้อมูลการติดต่อ ---- */}
							<div className="py-4 sm:py-6">
								<div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
									<Phone className="text-orange-500" size={16} />
									<h3 className="text-sm sm:text-lg font-semibold text-gray-800">ข้อมูลการติดต่อ</h3>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">เบอร์โทรศัพท์</label>
										<input
											type="text"
											value={phone}
											onChange={(e) => setPhone(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>

									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">Line ID</label>
										<input
											type="text"
											value={lineId}
											onChange={(e) => setLineId(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4">
									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">Facebook</label>
										<input
											type="text"
											value={facebook}
											onChange={(e) => setFacebook(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>

									<div>
										<label className="block text-xs sm:text-sm text-gray-500 mb-1">Instagram</label>
										<input
											type="text"
											value={instagram}
											onChange={(e) => setInstagram(e.target.value)}
											className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
										/>
									</div>
								</div>
							</div>

						</div>

						{/* ================= Action Row ================= */}
						<div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4">
							<Link
								to="/profile"
								className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-800 px-5 py-2.5 sm:px-8 sm:py-3.5 text-sm sm:text-base rounded-xl font-semibold shadow-sm hover:bg-gray-50 transition"
							>
								<X size={18} />
								ยกเลิก
							</Link>

							<button
								type="submit"
								disabled={saving}
								className="flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-5 py-2.5 sm:px-7 sm:py-3.5 text-sm sm:text-base rounded-xl font-semibold shadow-sm transition"
							>
								<Save size={18} />
								{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
							</button>
						</div>

					</form>
				)}

				{/* ================= Logout ================= */}
				<button
					onClick={handleLogoutClick}
					className="w-full bg-white hover:bg-red-50 border border-red-200 text-red-500 rounded-2xl py-2.5 sm:py-4 text-sm sm:text-base flex justify-center items-center gap-2 sm:gap-3 font-medium transition"
				>
					<LogOut size={18} className="sm:hidden" />
					<LogOut size={20} className="hidden sm:block" />
					ออกจากระบบ
				</button>

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
		</div >
	);
}