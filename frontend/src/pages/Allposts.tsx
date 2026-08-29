import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Home,
	Image,
	FileText,
	Bell,
	User,
	MapPin,
	Clock,
	Search,
	SlidersHorizontal,
	Menu,
	X
} from "lucide-react";
import { getItems } from "../services/api";
import { formatRelativeTime } from "../utils/format";
import { getPlaceholderImage } from "../utils/placeholder";
import { LOCATIONS } from "../utils/locations";
import { useNotifications } from "../hooks/useNotifications";
import { getAvatarColor, getAvatarInitial } from "../utils/avatar";

// แปลง type จาก DB ("lost"/"found") เป็นข้อความไทยที่ UI เดิมใช้อยู่
const typeLabel = (type: string) => (type === "lost" ? "ของหาย" : "ของที่พบ");

const FALLBACK_IMAGE = getPlaceholderImage(500, 375);

export default function AllPosts() {
	const navigate = useNavigate();
	const [activeTab, setActiveTab] = useState<string>("ทั้งหมด");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [selectedLocation, setSelectedLocation] = useState<string>("all");
	const [showNoti, setShowNoti] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { notifications, unreadCount, markAllRead, markOneRead } = useNotifications();

	const [posts, setPosts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function loadPosts() {
			setLoading(true);
			setError(null);
			try {
				const data = await getItems();
				if (!cancelled) setPosts(data || []);
			} catch (err) {
				console.error(err);
				if (!cancelled) setError("โหลดประกาศไม่สำเร็จ ลองรีเฟรชหน้าใหม่");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadPosts();
		return () => { cancelled = true; };
	}, []);

	const filteredPosts = posts.filter((post) => {
		const matchesTab =
			activeTab === "ทั้งหมด" ||
			(activeTab === "ของหาย" && post.type === "lost") ||
			(activeTab === "ของที่พบ" && post.type === "found");

		const query = searchQuery.trim().toLowerCase();
		const matchesQuery =
			!query ||
			(post.title || "").toLowerCase().includes(query) ||
			(post.description || "").toLowerCase().includes(query) ||
			(post.location || "").toLowerCase().includes(query);

		const selectedLocationOption = LOCATIONS.find((loc) => loc.value === selectedLocation);
		const postLocationLower = (post.location || "").toLowerCase();
		const matchesLocation =
			selectedLocation === "all" ||
			postLocationLower.includes(selectedLocation.toLowerCase()) ||
			(selectedLocationOption?.keywords ?? []).some((kw) => postLocationLower.includes(kw.toLowerCase()));

		return matchesTab && matchesQuery && matchesLocation;
	});

	return (
		<div className="min-h-screen bg-gray-50 antialiased">

			{/* ================= Navbar ================= */}
			<nav className="bg-white shadow-sm border-b border-gray-300 relative">
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
						<Link to="/allposts" className="flex items-center gap-2 text-orange-500">
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
						<Link
							to="/"
							onClick={() => setMobileMenuOpen(false)}
							className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50"
						>
							<Home size={20} />
							หน้าแรก
						</Link>
						<Link
							to="/searchbyimage"
							onClick={() => setMobileMenuOpen(false)}
							className="flex items-center gap-3 py-3 text-gray-700 hover:text-orange-500 border-b border-gray-50"
						>
							<Image size={20} />
							ค้นหาจากรูป
						</Link>
						<Link
							to="/allposts"
							onClick={() => setMobileMenuOpen(false)}
							className="flex items-center gap-3 py-3 text-orange-500"
						>
							<FileText size={20} />
							ประกาศทั้งหมด
						</Link>
					</div>
				)}
			</nav>

			{/* ================= Main Container ================= */}
			<div className="max-w-6xl mx-auto p-6 space-y-6">

				{/* ---- (Filter & Search Header) ---- */}
				<div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">

					<div className="flex items-center justify-between flex-wrap gap-4">
						<div className="flex bg-gray-100 p-1.5 rounded-xl gap-1">
							{["ทั้งหมด", "ของหาย", "ของที่พบ"].map((tab) => {
								const getActiveColors = () => {
									if (tab === "ของหาย") return "bg-rose-500 text-white shadow-sm";
									if (tab === "ของที่พบ") return "bg-sky-500 text-white shadow-sm";
									return "bg-orange-500 text-white shadow-sm";
								};

								return (
									<button
										key={tab}
										onClick={() => setActiveTab(tab)}
										className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab
											? getActiveColors()
											: "text-gray-500 hover:text-gray-800 hover:bg-white/50"
											}`}
									>
										{tab}
									</button>
								);
							})}
						</div>

						<div className="text-sm text-gray-500 font-medium">
							พบทั้งหมด <span className="text-orange-500 font-bold text-base">{filteredPosts.length}</span> ประกาศ
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-12 gap-3">
						<div className="md:col-span-7 relative">
							<Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
							<input
								type="text"
								placeholder="ค้นหาชื่อสิ่งของ สี ลักษณะ หรือสถานที่พบ..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
							/>
						</div>

						<div className="md:col-span-3">
							<select
								value={selectedLocation}
								onChange={(e) => setSelectedLocation(e.target.value)}
								className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition text-gray-700 appearance-none cursor-pointer"
							>
								<option value="all">ทุกสถานที่ / คณะ</option>
								{LOCATIONS.map((loc) => (
									<option key={loc.value} value={loc.value}>{loc.label}</option>
								))}
							</select>
						</div>

						<button
							onClick={() => {
								setActiveTab("ทั้งหมด");
								setSearchQuery("");
								setSelectedLocation("all");
							}}
							className="md:col-span-2 flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-3 hover:bg-gray-50 text-gray-700 font-medium transition shadow-sm"
						>
							<SlidersHorizontal size={16} />
							ล้างตัวกรอง
						</button>
					</div>
				</div>

				{/* ---- สถานะโหลด/error/ว่างเปล่า ---- */}
				{loading && (
					<div className="text-center text-gray-400 py-16">กำลังโหลดประกาศ...</div>
				)}

				{!loading && error && (
					<div className="text-center text-rose-500 py-16">{error}</div>
				)}

				{!loading && !error && filteredPosts.length === 0 && (
					<div className="text-center text-gray-400 py-16">ยังไม่มีประกาศในหมวดนี้</div>
				)}

				{/* ---- ส่วนแสดงรายการประกาศ (Grid Cards) ---- */}
				{!loading && !error && filteredPosts.length > 0 && (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
						{filteredPosts.map((post) => (
							<div
								key={post.id}
								className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md border border-gray-100 transition-all flex flex-col group cursor-pointer"
								onClick={() => navigate(`/postdetail/${post.id}`)}
							>
								{/* ส่วนรูปภาพของโพสต์ */}
								<div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
									<img
										src={post.image_url || FALLBACK_IMAGE}
										alt={post.title}
										className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
										onError={(e) => {
											(e.target as HTMLImageElement).src = FALLBACK_IMAGE;
										}}
									/>

									<div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border border-gray-100 select-none">
										<span className={`w-2.5 h-2.5 rounded-full ${post.type === "lost" ? "bg-rose-500" : "bg-sky-500"
											}`} />
										<span className="text-xs font-semibold text-gray-700 tracking-wide">
											{typeLabel(post.type)}
										</span>
									</div>
								</div>

								{/* ส่วนเนื้อหาในโพสต์ */}
								<div className="p-5 flex-1 flex flex-col justify-between space-y-4">
									<div className="space-y-2">
										<h3 className="text-base font-semibold text-gray-800 line-clamp-2 pt-1 group-hover:text-orange-500 transition">
											{post.title || "ไม่ระบุชื่อสิ่งของ"}
										</h3>
									</div>

									<div className="space-y-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
										<div className="flex items-center gap-1.5">
											<MapPin size={14} className="text-gray-400" />
											<span>{post.location || "ไม่ระบุสถานที่"}</span>
										</div>
										<div className="flex items-center gap-1.5">
											<Clock size={14} className="text-gray-400" />
											<span>{post.created_at ? formatRelativeTime(post.created_at) : "-"}</span>
										</div>
									</div>

									<div className="flex items-center justify-between pt-3 border-t border-gray-100 mt-auto">
										<div className="flex items-center gap-2.5">
											{post.reporter_avatar_url ? (
												<img
													src={post.reporter_avatar_url}
													alt={post.reporter_name || "ผู้ประกาศ"}
													className="w-7 h-7 rounded-full object-cover flex-shrink-0"
												/>
											) : (
												<div
													className="w-7 h-7 rounded-full text-white text-xs font-bold flex items-center justify-center select-none flex-shrink-0"
													style={{ backgroundColor: getAvatarColor(post.reporter_name || "ผู้ประกาศ") }}
												>
													{getAvatarInitial(post.reporter_name || "ผู้ประกาศ")}
												</div>
											)}
											<span className="text-xs font-medium text-gray-600">
												{post.reporter_name || "ผู้ประกาศ"}
											</span>
										</div>

										<button
											onClick={(e) => {
												e.stopPropagation();
												navigate(`/postdetail/${post.id}`);
											}}
											className="text-xs bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white font-semibold px-3 py-1.5 rounded-lg transition-all border border-orange-200 hover:border-orange-500 shadow-sm duration-200"
										>
											ดูรายละเอียดเพิ่มเติม
										</button>
									</div>
								</div>
							</div>
						))}
					</div>
				)}

			</div>
		</div>
	);
}