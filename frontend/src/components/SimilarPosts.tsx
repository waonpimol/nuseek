import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import { getSimilarItems } from '../services/api';
import { formatRelativeTime } from '../utils/format';
import { getPlaceholderImage } from '../utils/placeholder';

const FALLBACK_IMAGE = getPlaceholderImage(600, 400);

type SimilarItem = {
  id: string;
  type: 'lost' | 'found';
  title?: string;
  location?: string;
  created_at?: string;
  image_url?: string;
  score?: number;
};

/**
 * ส่วน "โพสต์ที่คล้ายกัน" ท้ายหน้ารายละเอียดโพสต์
 * ดึงจาก GET /items/{id}/similar แล้วโชว์เป็นแถวการ์ดเลื่อนแนวนอน (หน้าตาเดียวกับผลค้นหาด้วยรูป)
 * ถ้าโหลดไม่สำเร็จหรือไม่มีโพสต์ที่คล้ายพอ จะไม่แสดงอะไรเลย (ไม่รบกวนหน้าหลัก)
 */
export default function SimilarPosts({ itemId }: { itemId: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<SimilarItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    getSimilarItems(itemId)
      .then((data) => { if (!cancelled) setItems(Array.isArray(data) ? data : []); })
      .catch((err) => console.error(err));
    return () => { cancelled = true; };
  }, [itemId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-8 sm:mt-10 pb-16">
      <h3 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">โพสต์ที่คล้ายกัน</h3>
      <div className="-mx-4 sm:mx-0 px-4 sm:px-0 pt-1 pb-8 -mb-4 flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:thin]">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => navigate(`/postdetail/${item.id}`)}
            className="group w-[68%] sm:w-[280px] flex-shrink-0 snap-start bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 transition-all duration-200 ease-out flex flex-col cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_36px_-6px_rgba(0,0,0,0.18)] active:translate-y-0 active:scale-[0.97] active:shadow-sm"
          >
            <div className="relative w-full aspect-[4/3] flex-shrink-0 overflow-hidden bg-gray-100">
              <img
                src={item.image_url || FALLBACK_IMAGE}
                alt={item.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <div className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full shadow-sm select-none text-[11px] sm:text-xs font-semibold text-white ${item.type === 'lost' ? 'bg-red-500' : 'bg-sky-500'}`}>
                {item.type === 'lost' ? 'หาย' : 'พบ'}
              </div>
              <div className="absolute top-2.5 right-2.5 bg-orange-500 text-white text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                {Math.round((item.score || 0) * 100)}%
              </div>
            </div>
            <div className="p-3 sm:p-4 flex-1 flex flex-col gap-2 min-w-0">
              <div className="w-6 sm:w-8 h-1 rounded-full bg-orange-500" />
              <h4 className="text-base sm:text-lg font-extrabold tracking-tight text-gray-900 leading-tight line-clamp-2 group-hover:text-orange-500 transition">
                {item.title || 'ไม่ระบุชื่อสิ่งของ'}
              </h4>
              <div className="space-y-1.5 pt-2 border-t border-gray-100 text-xs text-gray-500">
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
        ))}
        {/* ช่องว่างท้ายแถว (มือถือ) ให้ปัดจนสุดแล้วการ์ดใบสุดท้ายไม่ติดขอบจอ */}
        <div className="w-1 flex-shrink-0 sm:hidden" aria-hidden="true" />
      </div>
    </section>
  );
}
