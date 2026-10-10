import { useEffect, useRef, useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { identifyItem } from "../services/api";
import Spinner from "./Spinner";

type Suggestion = Awaited<ReturnType<typeof identifyItem>>;

const CONFIDENCE_TEXT: Record<Suggestion["confidence"], string> = {
  high: "มั่นใจสูง",
  medium: "มั่นใจปานกลาง",
  low: "มั่นใจต่ำ ลองตรวจสอบอีกครั้ง",
};

// ข้อความความคืบหน้าระหว่างรอ (สลับทุก ~2.5 วินาที เพื่อให้รู้ว่ายังทำงานอยู่ ไม่ได้ค้าง)
const PROGRESS_STEPS = [
  "AI กำลังดูรูป...",
  "กำลังอ่านโลโก้และข้อความบนตัวของ...",
  "กำลังสรุปชื่อ ยี่ห้อ รุ่น...",
  "ใกล้เสร็จแล้ว รออีกนิดนะ...",
];

// ปุ่ม "ให้ AI ช่วยระบุสิ่งของ" ใช้ในหน้าแจ้งของหาย/แจ้งพบของ
// กดเองเท่านั้น (ไม่ทำอัตโนมัติ) ผลเป็นคำแนะนำ ผู้ใช้กด "ใช้ชื่อนี้" เพื่อเติมช่องชื่อเอง
export default function AiIdentify({ file, onApply }: { file: File | null; onApply: (title: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const latestFile = useRef<File | null>(file); // รูปล่าสุดตอนนี้ ใช้เช็กว่าผลที่กลับมายังเป็นของรูปเดิมไหม

  // เปลี่ยนรูปแรก → ล้างผลเก่า (กันเสนอชื่อของรูปเดิม)
  useEffect(() => {
    latestFile.current = file;
    setSuggestion(null);
    setError(null);
    setLoading(false);
  }, [file]);

  // ระหว่างโหลด ไล่ข้อความความคืบหน้าไปทีละขั้น (ค้างที่ขั้นสุดท้าย)
  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1)), 2500);
    return () => clearInterval(timer);
  }, [loading]);

  const handleIdentify = async () => {
    if (!file || loading) return;
    const current = file;
    setLoading(true);
    setSuggestion(null);
    setError(null);
    try {
      const result = await identifyItem(current);
      if (current !== latestFile.current) return; // ผู้ใช้เปลี่ยนรูประหว่างรอ ทิ้งผลเก่า
      if (!result.title) {
        setError("AI ระบุสิ่งของจากรูปนี้ไม่ได้ ลองถ่ายให้เห็นตัวของ/โลโก้ชัดขึ้น หรือพิมพ์ชื่อเอง");
      } else {
        setSuggestion(result);
      }
    } catch (err) {
      if (current === latestFile.current) setError(err instanceof Error ? err.message : "ระบุสิ่งของไม่สำเร็จ");
    } finally {
      if (current === latestFile.current) setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: "8px", marginBottom: "4px" }}>
      <button
        type="button"
        onClick={handleIdentify}
        disabled={!file || loading}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-full border border-orange-300 text-orange-600 bg-white hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {loading ? <Spinner size={14} /> : <Sparkles size={14} />}
        {loading ? PROGRESS_STEPS[step] : "ให้ AI ช่วยระบุสิ่งของ"}
      </button>
      {!file && (
        <span className="ml-2 text-[11px] sm:text-xs text-gray-400">แนบรูปก่อน แล้วกดให้ AI ช่วยระบุชื่อ ยี่ห้อ รุ่น</span>
      )}

      {file && !loading && !suggestion && !error && (
        <p className="mt-1.5 text-[11px] sm:text-xs text-gray-400">AI ช่วยแนะนำเท่านั้น ตรวจสอบกับของจริงก่อนใช้ชื่อทุกครั้ง</p>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-rose-500">{error}</p>}

      {suggestion && (
        <div className="mt-2 flex items-center gap-3 flex-wrap rounded-xl bg-orange-50 border border-orange-100 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800 break-words">{suggestion.title}</p>
            <p className="text-[11px] sm:text-xs text-gray-500">
              AI แนะนำจากรูป · {CONFIDENCE_TEXT[suggestion.confidence]} · ตรวจสอบก่อนใช้ทุกครั้ง
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                onApply(suggestion.title);
                setSuggestion(null);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-orange-500 hover:bg-orange-600 text-white transition"
            >
              <Check size={14} /> ใช้ชื่อนี้
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              aria-label="ปิดคำแนะนำ"
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-white transition"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}