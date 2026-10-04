import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, KeyRound, MailCheck, ArrowLeft } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { isValidEmail, translateAuthError } from "../utils/validation";
import ResultModal from "../components/ResultModal";
import Spinner from "../components/Spinner";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorModal, setErrorModal] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setErrorModal("กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com");
      return;
    }

    setLoading(true);
    try {
      // ลิงก์ในอีเมลจะพากลับมาที่หน้า /reset-password ของเว็บเรา
      // (URL นี้ต้องเพิ่มใน Supabase → Authentication → URL Configuration → Redirect URLs)
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;

      // Supabase ตอบสำเร็จเหมือนกันไม่ว่าอีเมลนี้จะมีบัญชีหรือไม่ (กันคนเดาว่าอีเมลไหนสมัครไว้)
      // จึงใช้ข้อความกลางๆ ที่ไม่ยืนยันว่ามีบัญชี
      setSent(true);
    } catch (error: any) {
      setErrorModal(translateAuthError(error.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-5 sm:p-8">

        {sent ? (
          <>
            <div className="flex justify-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#FF6B00] rounded-2xl flex items-center justify-center">
                <MailCheck className="text-white w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            </div>

            <h1 className="text-center text-xl sm:text-3xl font-semibold mt-3 sm:mt-5">
              <span className="text-[#FF6B00]">ตรวจสอบ</span>
              <span className="text-gray-900">อีเมลของคุณ</span>
            </h1>

            <p className="text-center text-gray-500 text-xs sm:text-base mt-3 sm:mt-4 leading-relaxed">
              ถ้า <span className="font-semibold text-gray-700 break-all">{email.trim()}</span> มีบัญชีอยู่ในระบบ
              เราได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้แล้ว
            </p>
            <p className="text-center text-gray-400 text-xs mt-2">
              ถ้าไม่เห็นอีเมล ลองดูในกล่องสแปม/ขยะ ลิงก์มีอายุจำกัด
            </p>

            <Link
              to="/login"
              className="mt-6 w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition"
            >
              กลับไปหน้าเข้าสู่ระบบ
            </Link>

            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-3 w-full text-center text-[#FF6B00] hover:underline text-xs sm:text-sm"
            >
              ไม่ได้รับอีเมล? ลองส่งอีกครั้ง
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#FF6B00] rounded-2xl flex items-center justify-center">
                <KeyRound className="text-white w-6 h-6 sm:w-8 sm:h-8" />
              </div>
            </div>

            <h1 className="text-center text-xl sm:text-3xl font-semibold mt-3 sm:mt-5">
              <span className="text-[#FF6B00]">ลืม</span>
              <span className="text-gray-900">รหัสผ่าน</span>
            </h1>

            <p className="text-center text-gray-500 text-xs sm:text-base mt-1.5 sm:mt-2 mb-5 sm:mb-8">
              กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้
            </p>

            <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5">
              <div>
                <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">อีเมล</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    disabled={loading}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition disabled:bg-gray-400"
              >
                {loading ? (<><Spinner size={16} />กำลังส่งลิงก์...</>) : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}
              </button>
            </form>

            <Link
              to="/login"
              className="mt-5 sm:mt-6 flex items-center justify-center gap-1.5 text-gray-600 hover:text-[#FF6B00] text-sm sm:text-base transition"
            >
              <ArrowLeft size={16} />
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </>
        )}
      </div>

      <ResultModal
        open={!!errorModal}
        success={false}
        title="ส่งลิงก์ไม่สำเร็จ"
        message={errorModal || ""}
        onConfirm={() => setErrorModal(null)}
      />
    </div>
  );
}
