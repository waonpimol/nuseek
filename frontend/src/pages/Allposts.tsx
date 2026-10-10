import { useState, useEffect, useRef, type SyntheticEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
	Home,
	Image,
	FileText,
	User,
	Search,
	SlidersHorizontal,
	Menu,
	X,
	SearchX,
	MapPin,
	Clock,
	PackageSearch,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	Check
} from "lucide-react";
import { getItems } from "../services/api";
import { formatRelativeTime } from "../utils/format";
import { LOCATIONS } from "../utils/locations";
import NotificationBell from "../components/NotificationBell";
import PostSkeletonList from "../components/PostSkeleton";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import { getPlaceholderImage } from "../utils/placeholder";
import { getAvatarColor, getAvatarInitial } from "../utils/avatar";

const PAGE_SIZE = 9;

const FALLBACK_IMAGE = getPlaceholderImage(500, 375);

// สไลด์รูปในการ์ด: ปัดซ้าย-ขวาบนมือถือ / กดลูกศรบนจอใหญ่ มีตัวนับ (2/3) และจุดบอกตำแหน่ง
function ImageCarousel({ post, score }: { post: any; score?: number }) {
	const imgs: string[] = post.image_urls?.length
		? post.image_urls
		: post.image_url
			? [post.image_url]
			: [FALLBACK_IMAGE];
	const trackRef = useRef<HTMLDivElement>(null);
	const [index, setIndex] = useState(0);
	const multi = imgs.length > 1;

	const goTo = (i: number) => {
		const el = trackRef.current;
		if (!el) return;
		const next = Math.max(0, Math.min(i, imgs.length - 1));
		el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
	};

	const onScroll = () => {
		const el = trackRef.current;
		if (!el || !el.clientWidth) return;
		setIndex(Math.round(el.scrollLeft / el.clientWidth));
	};

	const onErr = (e: SyntheticEvent<HTMLImageElement>) => {
		e.currentTarget.src = FALLBACK_IMAGE;
	};

	const stop = (e: ReactMouseEvent) => e.stopPropagation();

	return (
		<div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
			<div
				ref={trackRef}
				onScroll={onScroll}
				className="flex w-full h-full overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{imgs.map((url, i) => (
					<img
						key={i}
						src={url}
						alt={`${post.title} รูปที่ ${i + 1}`}
						draggable={false}
						loading={i === 0 ? "eager" : "lazy"}
						className="w-full h-full object-cover flex-shrink-0 snap-center"
						onError={onErr}
					/>
				))}
			</div>

			{/* ป้ายประเภททับรูป: พื้นสีทึบ ตัวอักษรขาว (หาย = แดง / พบ = ฟ้า) */}
			<div className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 shadow-sm select-none pointer-events-none ${post.type === "lost" ? "bg-red-500" : "bg-sky-500"}`}>
				<span className="text-[11px] sm:text-xs font-semibold tracking-wide text-white">
					{post.type === "lost" ? "หาย" : "พบ"}
				</span>
			</div>

			{score !== undefined && (
				<div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 bg-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm select-none pointer-events-none">
					{Math.round(score * 100)}%
				</div>
			)}

			{multi && (
				<>
					<span className={`absolute right-2.5 sm:right-3 text-[11px] font-semibold text-white bg-black/55 rounded-full px-2 py-0.5 select-none pointer-events-none ${score !== undefined ? "top-11 sm:top-12" : "top-2.5 sm:top-3"}`}>
						{index + 1}/{imgs.length}
					</span>

					{index > 0 && (
						<button
							type="button"
							aria-label="รูปก่อนหน้า"
							onClick={(e) => { stop(e); goTo(index - 1); }}
							className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow opacity-0 group-hover:opacity-100 transition"
						>
							<ChevronLeft size={18} />
						</button>
					)}
					{index < imgs.length - 1 && (
						<button
							type="button"
							aria-label="รูปถัดไป"
							onClick={(e) => { stop(e); goTo(index + 1); }}
							className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow opacity-0 group-hover:opacity-100 transition"
						>
							<ChevronRight size={18} />
						</button>
					)}

					<div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
						{imgs.map((_, i) => (
							<span
								key={i}
								className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`}
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}

// การ์ดประกาศ ใช้ร่วมกันทั้งหน้า "ประกาศทั้งหมด" และ "ค้นหาด้วยรูป"
// score: ถ้าส่งมา (ผลค้นหาด้วยรูป) จะแสดงเปอร์เซ็นต์ความคล้ายที่มุมขวาบนของรูป
function PostCard({
	post,
	score,
	showReporter = true,
}: {
	post: any;
	score?: number;
	showReporter?: boolean;
}) {
	const navigate = useNavigate();
	return (
		<div
			className="relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_16px_-2px_rgba(0,0,0,0.12)] sm:shadow-sm border border-gray-200 sm:border-gray-100 transition-all duration-200 ease-out flex flex-row sm:flex-col group cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.97] active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
			role="link"
			tabIndex={0}
			onClick={() => navigate(`/postdetail/${post.id}`)}
			onKeyDown={(e) => {
				if (e.key === "Enter") navigate(`/postdetail/${post.id}`);
			}}
		>
			{/* มือถือ: รูปเล็กด้านซ้ายเป็นแถว (เหมือนเดิม) */}
			<div className="sm:hidden relative w-24 self-stretch min-h-24 flex-shrink-0 overflow-hidden bg-gray-100">
				<img
					src={post.image_url || FALLBACK_IMAGE}
					alt={post.title}
					className="absolute inset-0 w-full h-full object-cover"
					onError={(e) => {
						(e.target as HTMLImageElement).src = FALLBACK_IMAGE;
					}}
				/>
			</div>

			{/* จอใหญ่: สไลด์รูปเลื่อนดูได้ */}
			<div className="hidden sm:block">
				<ImageCarousel post={post} score={score} />
			</div>

			{/* ส่วนเนื้อหาในโพสต์ */}
			<div className="p-3 sm:p-5 flex-1 flex flex-col justify-center sm:justify-between gap-1.5 sm:gap-4 min-w-0">
				{/* ป้ายประเภทแบบข้อความเล็ก โชว์เฉพาะมือถือ (แทนป้ายทับรูป) */}
				<div className={`flex sm:hidden absolute top-2.5 right-2.5 items-center px-2 py-px rounded-full text-[11px] font-semibold text-white ${post.type === "lost" ? "bg-red-500" : "bg-sky-500"}`}>
					{post.type === "lost" ? "หาย" : "พบ"}
				</div>
				{/* ขีดสีส้มเล็กๆ เหนือชื่อ (จอใหญ่) */}
				<div className="hidden sm:block w-8 h-1 rounded-full bg-orange-500 -mb-1.5" />
				<h3 className="text-sm font-semibold text-gray-800 line-clamp-1 pr-9 sm:pr-0 sm:text-2xl sm:font-extrabold sm:tracking-tight sm:text-gray-900 sm:leading-tight sm:line-clamp-2 group-hover:text-orange-500 transition">
					{post.title || "ไม่ระบุชื่อสิ่งของ"}
				</h3>
				{/* มือถือ: ขีดสีส้มอยู่ใต้ชื่อ */}
				<div className="sm:hidden w-6 h-1 rounded-full bg-orange-500 -mt-0.5" />

				<div className="space-y-1 sm:space-y-2 sm:pt-2.5 sm:border-t sm:border-gray-100 text-xs text-gray-500">
					<div className="flex items-center gap-1.5 truncate">
						<MapPin size={13} className="text-gray-400 flex-shrink-0" />
						<span className="truncate">{post.location || "ไม่ระบุสถานที่"}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Clock size={13} className="text-gray-400 flex-shrink-0" />
						<span>{post.created_at ? formatRelativeTime(post.created_at) : "-"}</span>
					</div>
				</div>

				{/* แถวผู้ประกาศ: โชว์เฉพาะจอใหญ่ (การ์ดทั้งใบกดได้อยู่แล้วบนมือถือ) */}
				{showReporter && (
				<div className="hidden sm:flex items-center pt-3 border-t border-gray-100 mt-auto">
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
				</div>
				)}
			</div>
		</div>
	);
}


// ตัวเลือกแบบกำหนดเอง (แทน <select> ของเบราว์เซอร์ เพื่อให้รายการขอบมนและดูเรียบๆ) ใช้ทั้งตัวกรองประเภทและสถานที่
function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: globalThis.MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const current = options.find((o) => o.value === value)?.label ?? options[0].label;

	return (
		<div ref={wrapRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="listbox"
				aria-expanded={open}
				className={`w-full flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 text-sm bg-gray-50 border rounded-xl outline-none transition text-gray-700 ${open ? "border-gray-300 bg-white" : "border-gray-200 hover:border-gray-300"}`}
			>
				<span className="truncate">{current}</span>
				<ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
			</button>

			{open && (
				<ul
					role="listbox"
					className="absolute z-30 left-0 right-0 mt-2 max-h-72 overflow-y-auto bg-white border border-gray-100 rounded-2xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.15)] p-1.5 [scrollbar-width:thin]"
				>
					{options.map((o) => {
						const selected = o.value === value;
						return (
							<li key={o.value} role="option" aria-selected={selected}>
								<button
									type="button"
									onClick={() => { onChange(o.value); setOpen(false); }}
									className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 rounded-xl text-sm transition-colors ${selected ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
								>
									<span className="truncate">{o.label}</span>
									{selected && <Check size={15} className="flex-shrink-0" />}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}

export default function AllPosts() {
	const [activeTab, setActiveTab] = useState<string>("ทั้งหมด");
	const [searchQuery, setSearchQuery] = useState<string>("");
	const [selectedLocation, setSelectedLocation] = useState<string>("all");

	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const [posts, setPosts] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadKey, setReloadKey] = useState(0); // เพิ่มค่านี้เพื่อสั่งโหลดประกาศใหม่ (ปุ่ม "ลองใหม่")

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
				if (!cancelled) setError("โหลดประกาศไม่สำเร็จ");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadPosts();
		return () => { cancelled = true; };
	}, [reloadKey]);

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

	// มีตัวกรอง/คำค้นอยู่ไหม — ใช้แยกว่า "ไม่เจอเพราะกรอง" หรือ "ยังไม่มีประกาศเลย"
	const hasActiveFilter =
		activeTab !== "ทั้งหมด" || searchQuery.trim() !== "" || selectedLocation !== "all";

	// แบ่งหน้า: หน้าละ 9 การ์ด
	const [page, setPage] = useState(1);
	const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pagedPosts = filteredPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

	// เปลี่ยนตัวกรอง/คำค้น → กลับไปหน้า 1
	useEffect(() => {
		setPage(1);
	}, [activeTab, searchQuery, selectedLocation]);

	const goToPage = (n: number) => {
		setPage(Math.max(1, Math.min(n, totalPages)));
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	// เลขหน้าที่จะแสดง (หน้าแรก/สุดท้าย + รอบหน้าปัจจุบัน ที่เหลือเป็น …)
	const pageNumbers: (number | "gap")[] = [];
	for (let i = 1; i <= totalPages; i++) {
		if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
			pageNumbers.push(i);
		} else if (pageNumbers[pageNumbers.length - 1] !== "gap") {
			pageNumbers.push("gap");
		}
	}

	const clearFilters = () => {
		setActiveTab("ทั้งหมด");
		setSearchQuery("");
		setSelectedLocation("all");
	};

	return (
		<div className="min-h-screen bg-cream antialiased">

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
						<NotificationBell />

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
							className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50"
						>
							<Home size={20} />
							หน้าแรก
						</Link>
						<Link
							to="/searchbyimage"
							onClick={() => setMobileMenuOpen(false)}
							className="flex items-center gap-2.5 py-2.5 text-sm text-gray-700 hover:text-orange-500 border-b border-gray-50"
						>
							<Image size={20} />
							ค้นหาจากรูป
						</Link>
						<Link
							to="/allposts"
							onClick={() => setMobileMenuOpen(false)}
							className="flex items-center gap-2.5 py-2.5 text-sm text-orange-500"
						>
							<FileText size={20} />
							ประกาศทั้งหมด
						</Link>
					</div>
				)}
			</nav>

			{/* ================= Main Container ================= */}
			<div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

				{/* ---- (Filter & Search Header) ---- */}
				<div className="bg-white rounded-2xl p-3 sm:p-6 shadow-sm border border-gray-100 space-y-3 sm:space-y-4">

					<div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3">
						<div className="md:col-span-5 relative">
							<Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
							<input
								type="text"
								placeholder="ค้นหาชื่อสิ่งของ สี ลักษณะ หรือสถานที่พบ..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full pl-9 sm:pl-11 pr-3 sm:pr-4 py-2 sm:py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-orange-400 focus:bg-white transition"
							/>
						</div>

						<div className="md:col-span-2">
							<FilterSelect
								value={activeTab}
								onChange={setActiveTab}
								options={[
									{ value: "ทั้งหมด", label: "ทุกประเภท" },
									{ value: "ของหาย", label: "ของหาย" },
									{ value: "ของที่พบ", label: "ของที่พบ" },
								]}
							/>
						</div>

						<div className="md:col-span-3">
							<FilterSelect
								value={selectedLocation}
								onChange={setSelectedLocation}
								options={[
									{ value: "all", label: "ทุกสถานที่ / คณะ" },
									...LOCATIONS.map((l) => ({ value: l.value, label: l.label })),
								]}
							/>
						</div>

						<button
							onClick={clearFilters}
							className="md:col-span-2 flex items-center justify-center gap-1.5 sm:gap-2 border border-gray-200 rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-sm hover:bg-gray-50 text-gray-700 font-medium transition shadow-sm"
						>
							<SlidersHorizontal size={14} />
							ล้างตัวกรอง
						</button>
					</div>
				</div>

				{/* ---- สถานะโหลด/error/ว่างเปล่า ---- */}
				{loading && (
					<PostSkeletonList count={6} className="gap-3 sm:gap-6" />
				)}

				{!loading && error && (
					<ErrorState title={error} description="ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง">
						<button onClick={() => setReloadKey((k) => k + 1)} className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">ลองใหม่</button>
					</ErrorState>
				)}

				{!loading && !error && filteredPosts.length === 0 && (
					hasActiveFilter ? (
						<EmptyState
							icon={SearchX}
							title="ไม่พบประกาศที่ตรงกับตัวกรอง"
							description="ลองเปลี่ยนคำค้นหา เลือกสถานที่อื่น หรือล้างตัวกรองเพื่อดูประกาศทั้งหมด"
						>
							<button onClick={clearFilters} className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">ล้างตัวกรอง</button>
						</EmptyState>
					) : (
						<EmptyState
							icon={PackageSearch}
							title="ยังไม่มีประกาศในระบบ"
							description="เป็นคนแรกที่ช่วยให้ของกลับถึงเจ้าของ แจ้งของหายหรือแจ้งพบของได้เลย"
						>
							<Link to="/reportlost" className="inline-flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">แจ้งของหาย</Link>
							<Link to="/reportfound" className="inline-flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 text-xs sm:text-sm rounded-xl font-semibold transition">แจ้งพบของ</Link>
						</EmptyState>
					)
				)}

				{/* ---- ส่วนแสดงรายการประกาศ (Grid Cards) ---- */}
				{!loading && !error && filteredPosts.length > 0 && (
					<>
					<div className="text-xs sm:text-sm text-gray-500 font-medium text-right">
						<span className="text-orange-500 font-bold text-sm sm:text-base">{filteredPosts.length}</span> ประกาศ
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6">
						{pagedPosts.map((post) => (
							<PostCard key={post.id} post={post} />
						))}
					</div>

					{totalPages > 1 && (
						<nav className="flex items-center justify-center gap-1.5 pt-2 pb-4" aria-label="เลือกหน้า">
							<button
								type="button"
								onClick={() => goToPage(currentPage - 1)}
								disabled={currentPage === 1}
								aria-label="หน้าก่อนหน้า"
								className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition"
							>
								<ChevronLeft size={18} />
							</button>
							{pageNumbers.map((n, i) =>
								n === "gap" ? (
									<span key={`gap-${i}`} className="w-6 text-center text-gray-400 select-none">…</span>
								) : (
									<button
										key={n}
										type="button"
										onClick={() => goToPage(n)}
										aria-current={n === currentPage ? "page" : undefined}
										className={`min-w-9 h-9 px-2 rounded-full text-sm font-medium transition ${n === currentPage ? "bg-orange-500 text-white shadow-sm" : "text-gray-600 hover:bg-white hover:shadow-sm"}`}
									>
										{n}
									</button>
								)
							)}
							<button
								type="button"
								onClick={() => goToPage(currentPage + 1)}
								disabled={currentPage === totalPages}
								aria-label="หน้าถัดไป"
								className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition"
							>
								<ChevronRight size={18} />
							</button>
						</nav>
					)}
					</>
				)}

			</div>
		</div>
	);
}