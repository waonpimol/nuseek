import { useState, useEffect, useRef } from "react";
import Logo from "../components/Logo";
import { Link, useSearchParams } from "react-router-dom";
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
	PackageSearch,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	Check,
	ArrowUpDown
} from "lucide-react";
import { getItems } from "../services/api";
import { LOCATIONS } from "../utils/locations";
import NotificationBell from "../components/NotificationBell";
import PostSkeletonList from "../components/PostSkeleton";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import PostCard from "../components/PostGridCard";

const PAGE_SIZE = 12; // หาร 2/3/4 ลงตัว แถวสุดท้ายไม่แหว่งทุกขนาดจอ

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
	// รับคำค้น/ประเภทที่ส่งมาจากหน้าแรก (/allposts?q=กุญแจ&type=lost)
	const [searchParams] = useSearchParams();
	const initialType = searchParams.get("type");
	const [activeTab, setActiveTab] = useState<string>(
		initialType === "lost" ? "ของหาย" : initialType === "found" ? "ของที่พบ" : "ทั้งหมด"
	);
	const [searchQuery, setSearchQuery] = useState<string>(searchParams.get("q") ?? "");
	const [selectedLocation, setSelectedLocation] = useState<string>("all");
	const [sortNewest, setSortNewest] = useState(true);

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

	// /items ไม่ได้เรียงจากหลังบ้าน จึงเรียงตามเวลาที่นี่
	filteredPosts.sort((a, b) => {
		const diff = new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
		return sortNewest ? diff : -diff;
	});

	// มีตัวกรอง/คำค้นอยู่ไหม — ใช้แยกว่า "ไม่เจอเพราะกรอง" หรือ "ยังไม่มีประกาศเลย"
	const hasActiveFilter =
		activeTab !== "ทั้งหมด" || searchQuery.trim() !== "" || selectedLocation !== "all";

	const [page, setPage] = useState(1);
	const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pagedPosts = filteredPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

	useEffect(() => {
		setPage(1);
	}, [activeTab, searchQuery, selectedLocation, sortNewest]);

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

			{/* Navbar */}
			<nav className="bg-white shadow-sm border-b border-gray-300 relative">
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
							<Image size={20} />
							ค้นหาจากรูป
						</Link>
						<Link to="/allposts" className="flex items-center gap-2 text-orange-500">
							<FileText size={20} />
							ประกาศทั้งหมด
						</Link>
					</div>

					<div className="flex items-center gap-2 md:gap-4">
						<NotificationBell />

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

			{/* Main Container */}
			<div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

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
					<PostSkeletonList count={8} showReporter={false} gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" className="gap-3 sm:gap-5" />
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
					<div className="flex items-center justify-between gap-3 text-xs sm:text-sm text-gray-500 font-medium">
						<button
							type="button"
							onClick={() => setSortNewest((v) => !v)}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 hover:border-orange-300 hover:text-orange-500 transition"
							aria-label="สลับการเรียงลำดับ"
						>
							<ArrowUpDown size={14} />
							เรียง: {sortNewest ? "ใหม่สุด" : "เก่าสุด"}
						</button>
						<div>
							<span className="text-orange-500 font-bold text-sm sm:text-base">{filteredPosts.length}</span> ประกาศ
						</div>
					</div>
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-5">
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