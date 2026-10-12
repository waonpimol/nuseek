import { useState, useRef, type SyntheticEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { formatRelativeTime } from "../utils/format";
import { getPlaceholderImage } from "../utils/placeholder";
import { getAvatarColor, getAvatarInitial } from "../utils/avatar";

const FALLBACK_IMAGE = getPlaceholderImage(500, 375);

// สไลด์รูปในการ์ด: ปัดซ้าย-ขวาบนมือถือ / กดลูกศรบนจอใหญ่ มีตัวนับ (2/3) และจุดบอกตำแหน่ง
function ImageCarousel({ post, score, matched }: { post: any; score?: number; matched?: boolean }) {
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
			<div className={`absolute top-2.5 left-2.5 sm:top-3 sm:left-3 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2 shadow-sm select-none pointer-events-none ${matched ? "bg-green-500" : post.type === "lost" ? "bg-red-500" : "bg-sky-500"}`}>
				<span className="text-[11px] sm:text-xs font-semibold tracking-wide text-white">
					{matched ? "สำเร็จ" : post.type === "lost" ? "หาย" : "พบ"}
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
// showReporter: ค่าเริ่มต้นไม่แสดงผู้ประกาศบนการ์ด (การ์ดแคบลงเป็น 4 ต่อแถว และชื่อผู้ประกาศดูได้ในหน้ารายละเอียด)
export default function PostCard({
	post,
	score,
	showReporter = false,
	matched = false,
}: {
	post: any;
	score?: number;
	showReporter?: boolean;
	matched?: boolean;
}) {
	const navigate = useNavigate();
	return (
		<div
			className="relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_16px_-2px_rgba(0,0,0,0.12)] sm:shadow-sm border border-gray-200 sm:border-gray-100 transition-all duration-200 ease-out flex flex-row sm:flex-col p-2 gap-3 sm:p-0 sm:gap-0 group cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.97] active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
			role="link"
			tabIndex={0}
			onClick={() => navigate(`/postdetail/${post.id}`)}
			onKeyDown={(e) => {
				if (e.key === "Enter") navigate(`/postdetail/${post.id}`);
			}}
		>
			{/* มือถือ: รูปเล็กด้านซ้ายเป็นแถว (เหมือนเดิม) */}
			<div className="sm:hidden relative w-[84px] self-stretch min-h-[84px] flex-shrink-0 overflow-hidden rounded-xl bg-gray-100">
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
				<ImageCarousel post={post} score={score} matched={matched} />
			</div>

			{/* ส่วนเนื้อหาในโพสต์ */}
			<div className="p-0 pr-1 sm:p-4 flex-1 flex flex-col justify-center sm:justify-start gap-1.5 sm:gap-3 min-w-0">
				{/* ขีดสีส้มเล็กๆ เหนือชื่อ (จอใหญ่) */}
				<div className="hidden sm:block w-8 h-1 rounded-full bg-orange-500 -mb-1.5" />
				<div className="flex sm:block items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
					<h3 className="text-base font-extrabold tracking-tight text-gray-900 leading-snug line-clamp-1 min-w-0 sm:text-lg sm:leading-snug sm:min-h-[3.1rem] sm:line-clamp-2 group-hover:text-orange-500 transition">
						{post.title || "ไม่ระบุชื่อสิ่งของ"}
					</h3>
					{/* ป้ายประเภทอยู่ข้างหลังชื่อ โชว์เฉพาะมือถือ (จอใหญ่ใช้ป้ายทับรูป) */}
					<span className={`sm:hidden flex-shrink-0 px-2 py-px rounded-full text-[11px] font-semibold text-white ${matched ? "bg-green-500" : post.type === "lost" ? "bg-red-500" : "bg-sky-500"}`}>
						{matched ? "สำเร็จ" : post.type === "lost" ? "หาย" : "พบ"}
					</span>
				</div>
				{/* มือถือ: ขีดสีส้มอยู่ใต้ชื่อ */}
				<div className="sm:hidden w-6 h-1 rounded-full bg-orange-500 -mt-0.5" />

				<div className="space-y-1 sm:space-y-1.5 sm:pt-2.5 sm:border-t sm:border-gray-100 text-xs text-gray-600 sm:text-gray-500 sm:mt-auto">
					<div className="flex items-center gap-1.5 truncate">
						<MapPin size={13} className="text-gray-400 flex-shrink-0" />
						<span className="truncate">{post.location || "ไม่ระบุสถานที่"}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<Clock size={13} className="text-gray-400 flex-shrink-0" />
						<span>
							{matched && post.resolved_at
								? `จบเคส ${formatRelativeTime(post.resolved_at)}`
								: post.created_at ? formatRelativeTime(post.created_at) : "-"}
						</span>
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