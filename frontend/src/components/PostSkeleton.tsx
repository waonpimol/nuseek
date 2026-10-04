function PostSkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 flex flex-row sm:flex-col animate-pulse">
      {/* รูป */}
      <div className="w-24 h-24 sm:w-full sm:h-auto sm:aspect-[4/3] flex-shrink-0 bg-gray-200" />

      {/* เนื้อหา */}
      <div className="p-3 sm:p-5 flex-1 min-w-0 flex flex-col justify-center sm:justify-between gap-2 sm:gap-4">
        <div className="space-y-2">
          <div className="h-2.5 w-14 rounded-full bg-gray-200" />
          <div className="h-4 w-3/4 rounded-full bg-gray-200" />
        </div>

        <div className="space-y-2">
          <div className="h-3 w-1/2 rounded-full bg-gray-200" />
          <div className="h-3 w-1/3 rounded-full bg-gray-200" />
        </div>

        {/* แถวผู้ประกาศ + ปุ่ม (โชว์เฉพาะจอใหญ่ เหมือนการ์ดจริง) */}
        <div className="hidden sm:flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="h-3 w-16 rounded-full bg-gray-200" />
          </div>
          <div className="h-7 w-28 rounded-lg bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

interface PostSkeletonListProps {
  count?: number;
  // ใช้ปรับ gap / margin ให้ตรงกับ grid จริงของแต่ละหน้า
  className?: string;
}

export default function PostSkeletonList({
  count = 6,
  className = "gap-3 sm:gap-6",
}: PostSkeletonListProps) {
  return (
    <div
      role="status"
      aria-label="กำลังโหลดประกาศ"
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <PostSkeletonCard key={i} />
      ))}
    </div>
  );
}
