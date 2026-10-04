import Spinner from "./Spinner";

interface PageLoaderProps {
  text?: string;
  // true = เต็มความสูงจอ (ใช้ตอนตรวจสิทธิ์ก่อนแสดงหน้า) / false = แทรกในเนื้อหาของหน้า
  fullScreen?: boolean;
}

// Loader กลางหน้าสำหรับช่วงโหลดสั้นๆ ที่ยังไม่รู้รูปร่างเนื้อหา (จึงไม่คุ้มทำ skeleton)
export default function PageLoader({ text, fullScreen = false }: PageLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${
        fullScreen ? "min-h-screen bg-gray-50" : "py-16"
      }`}
    >
      <Spinner size={36} className="text-orange-500" />
      {text && <p className="text-sm text-gray-400">{text}</p>}
    </div>
  );
}
