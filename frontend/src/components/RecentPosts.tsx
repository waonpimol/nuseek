import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { getItems } from '../services/api';
import { formatRelativeTime } from '../utils/format';
import { getPlaceholderImage } from '../utils/placeholder';

const FALLBACK_IMAGE = getPlaceholderImage(600, 400);
const MAX_ITEMS = 8;

type RecentItem = {
  id: string;
  type: 'lost' | 'found';
  title?: string;
  location?: string;
  created_at?: string;
  image_url?: string;
  image_urls?: string[];
};

/**
 * ส่วน "โพสต์ล่าสุด" ในหน้าแรก
 * ใช้ GET /items แล้วเรียงใหม่สุดก่อน เลือกตามแท็บ lost/found ตัดเหลือ MAX_ITEMS ใบ ท้ายแถวมีการ์ด "ดูทั้งหมด"
 * แถวเดียวเลื่อนแนวนอนได้: มือถือปัดนิ้ว / จอใหญ่กดลูกศรซ้าย-ขวา หรือเลื่อนด้วยเมาส์
 * ถ้าโหลดไม่สำเร็จหรือยังไม่มีโพสต์ จะไม่แสดงอะไร (หน้าแรกยังใช้งานได้ปกติ)
 */
export default function RecentPosts() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecentItem[]>([]);
  const [tab, setTab] = useState<'lost' | 'found'>('lost');
  const [loaded, setLoaded] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getItems()
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => console.error(err))
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // /items ยังไม่ได้เรียงจากฝั่งหลังบ้าน จึงเรียงใหม่สุดก่อนที่นี่
  const shown = items
    .filter((i) => i.type === tab)
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, MAX_ITEMS);

  // อัปเดตสถานะลูกศร (ซ่อนด้านที่เลื่อนไม่ได้แล้ว)
  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  // เปลี่ยนแท็บ/โหลดเสร็จ → กลับไปต้นแถวแล้วคำนวณลูกศรใหม่
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: 0 });
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
  }, [tab, items.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (loaded && items.length === 0) return null;

  return (
    <section className="mt-12 sm:mt-16 max-w-7xl mx-auto px-4 md:px-8">
      <div className="flex items-center justify-between gap-3 mb-3 sm:mb-4">
        <h3 className="text-base sm:text-xl font-bold text-gray-900">โพสต์ล่าสุด</h3>
        <Link
          to={`/allposts?type=${tab}`}
          className="flex items-center gap-1 text-xs sm:text-sm font-semibold text-orange-500 hover:text-orange-600"
        >
          ดูทั้งหมด <ArrowRight size={14} />
        </Link>
      </div>

      <div className="flex gap-2 mb-4" role="tablist">
        {([['lost', 'ของหาย'], ['found', 'ของที่พบ']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
              tab === value
                ? value === 'lost' ? 'bg-orange-500 text-white' : 'bg-sky-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!loaded && (
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" aria-hidden="true" />
      )}

      {loaded && shown.length === 0 && (
        <p className="text-sm text-gray-500 py-8 text-center">
          ยังไม่มี{tab === 'lost' ? 'ประกาศของหาย' : 'ประกาศของที่พบ'}
        </p>
      )}

      {shown.length > 0 && (
        <div className="relative">
          {canLeft && (
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label="เลื่อนไปทางซ้าย"
              className="hidden sm:flex absolute -left-4 top-[38%] -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md text-gray-700 hover:text-orange-500 hover:border-orange-300 transition"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {canRight && (
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label="เลื่อนไปทางขวา"
              className="hidden sm:flex absolute -right-4 top-[38%] -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md text-gray-700 hover:text-orange-500 hover:border-orange-300 transition"
            >
              <ChevronRight size={20} />
            </button>
          )}

          <div
            ref={trackRef}
            onScroll={updateArrows}
            className="-mx-4 px-4 sm:mx-0 sm:px-0 pt-1 pb-8 -mb-4 flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth [scrollbar-width:thin]"
          >
            {shown.map((item) => {
              const img = item.image_urls?.[0] || item.image_url || FALLBACK_IMAGE;
              return (
                <div
                  key={item.id}
                  onClick={() => navigate(`/postdetail/${item.id}`)}
                  className="group w-[62%] sm:w-[260px] flex-shrink-0 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-200 ease-out flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.97] active:shadow-sm"
                >
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
                    <img
                      src={img}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                    />
                    <div className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full shadow-sm select-none text-[11px] sm:text-xs font-semibold text-white ${item.type === 'lost' ? 'bg-red-500' : 'bg-sky-500'}`}>
                      {item.type === 'lost' ? 'หาย' : 'พบ'}
                    </div>
                  </div>
                  <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2 min-w-0">
                    <div className="w-6 sm:w-8 h-1 rounded-full bg-orange-500" />
                    <h4 className="text-sm sm:text-base font-extrabold tracking-tight text-gray-900 leading-tight line-clamp-2 group-hover:text-orange-500 transition">
                      {item.title || 'ไม่ระบุชื่อสิ่งของ'}
                    </h4>
                    <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs text-gray-500 mt-auto">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="truncate">{item.location || 'ไม่ระบุสถานที่'}</span>
                      </div>
                      {item.created_at && (
                        <div className="flex items-center gap-1.5">
                          <Clock size={13} className="text-gray-400 flex-shrink-0" />
                          <span>{formatRelativeTime(item.created_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <Link
              to={`/allposts?type=${tab}`}
              className="group w-[42%] sm:w-[160px] flex-shrink-0 snap-start rounded-2xl border-2 border-dashed border-gray-300 hover:border-orange-400 bg-white/60 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-orange-500 transition-colors text-center px-3"
            >
              <span className="w-10 h-10 rounded-full bg-white border border-gray-200 group-hover:border-orange-300 flex items-center justify-center">
                <ArrowRight size={18} />
              </span>
              <span className="text-xs sm:text-sm font-semibold">
                ดูประกาศ{tab === 'lost' ? 'ของหาย' : 'ของที่พบ'}ทั้งหมด
              </span>
            </Link>
            <div className="w-1 flex-shrink-0 sm:hidden" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}