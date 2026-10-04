import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, Check, X, ShieldCheck, LinkIcon } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { getPasswordChecks, isPasswordStrong, translateAuthError } from "../utils/validation";
import ResultModal from "../components/ResultModal";
import Spinner from "../components/Spinner";
import PageLoader from "../components/PageLoader";

type LinkStatus = "checking" | "ready" | "invalid";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState<{ success: boolean; message: string } | null>(null);

  const passwordChecks = getPasswordChecks(password);

  // ลิงก์ในอีเมลพาผู้ใช้มาพร้อม token ใน URL — supabase client อ่านแล้วสร้าง session ให้เองตอนโหลดหน้า
  // (getSession จะรอให้ขั้นตอนนั้นเสร็จก่อนคืนค่า) ถ้าไม่มี session แปลว่าลิงก์ผิด/หมดอายุ/ถูกใช้ไปแล้ว
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setStatus(data.session ? "ready" : "invalid");
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && mounted) setStatus("ready");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isPasswordStrong(password)) {
      setResultModal({ success: false, message: "รหัสผ่านยังไม่ปลอดภัยพอ กรุณาทำตามเงื่อนไขที่แสดงไว้ใต้ช่องรหัสผ่านให้ครบ" });
      return;
    }
    if (password !== confirmPassword) {
      setResultModal({ success: false, message: "รหัสผ่านไม่ตรงกัน" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // ออกจากระบบเพื่อล้าง session ชั่วคราวจากลิงก์ แล้วให้ล็อกอินด้วยรหัสใหม่ตามปกติ
      await supabase.auth.signOut();
      setResultModal({ success: true, message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่" });
    } catch (error: any) {
      const raw = (error.message || "").toLowerCase();
      if (raw.includes("different from the old password")) {
        setResultModal({ success: false, message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม" });
      } else if (raw.includes("session")) {
        setStatus("invalid");
      } else {
        setResultModal({ success: false, message: translateAuthError(error.message || "") });
      }
    } finally {
      setLoading(false);
    }
  };

  if (status === "checking") {
    return <PageLoader fullScreen />;
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-5 sm:p-8 text-center">
          <div className="flex justify-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-400 rounded-2xl flex items-center justify-center">
              <LinkIcon className="text-white w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>

          <h1 className="text-xl sm:text-3xl font-semibold mt-3 sm:mt-5 text-gray-900">
            ลิงก์ใช้ไม่ได้แล้ว
          </h1>
          <p className="text-gray-500 text-xs sm:text-base mt-2 sm:mt-3 leading-relaxed">
            ลิงก์ตั้งรหัสผ่านนี้อาจหมดอายุหรือถูกใช้ไปแล้ว กรุณาขอลิงก์ใหม่อีกครั้ง
          </p>

          <Link
            to="/forgot-password"
            className="mt-6 w-full flex items-center justify-center bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition"
          >
            ขอลิงก์ใหม่
          </Link>
          <Link to="/login" className="mt-3 block text-gray-600 hover:text-[#FF6B00] text-xs sm:text-sm transition">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-5 sm:p-8">

        <div className="flex justify-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#FF6B00] rounded-2xl flex items-center justify-center">
            <ShieldCheck className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <h1 className="text-center text-xl sm:text-3xl font-semibold mt-3 sm:mt-5">
          <span className="text-[#FF6B00]">ตั้ง</span>
          <span className="text-gray-900">รหัสผ่านใหม่</span>
        </h1>

        <p className="text-center text-gray-500 text-xs sm:text-base mt-1.5 sm:mt-2 mb-5 sm:mb-8">
          กรอกรหัสผ่านใหม่ที่ต้องการใช้เข้าสู่ระบบ
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5">

          {/* รหัสผ่านใหม่ */}
          <div>
            <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">รหัสผ่านใหม่</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-11 sm:pr-12 text-sm sm:text-base outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {(passwordFocused || password.length > 0) && (
              <ul className="mt-2 sm:mt-2.5 space-y-0.5 sm:space-y-1">
                {passwordChecks.map((check) => (
                  <li
                    key={check.label}
                    className={`flex items-center gap-1.5 text-[11px] sm:text-xs ${check.passed ? "text-emerald-600" : "text-gray-400"}`}
                  >
                    {check.passed ? <Check size={12} /> : <X size={12} />}
                    {check.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ยืนยันรหัสผ่านใหม่ */}
          <div>
            <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">ยืนยันรหัสผ่านใหม่</label>
            <div className="relative">
              <Check size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? (<><Spinner size={16} />กำลังบันทึก...</>) : "บันทึกรหัสผ่านใหม่"}
          </button>
        </form>
      </div>

      <ResultModal
        open={!!resultModal}
        success={resultModal?.success ?? true}
        title={resultModal?.success ? "ตั้งรหัสผ่านสำเร็จ" : "ตั้งรหัสผ่านไม่สำเร็จ"}
        message={resultModal?.message || ""}
        confirmLabel={resultModal?.success ? "ไปหน้าเข้าสู่ระบบ" : "ตกลง"}
        onConfirm={() => {
          const wasSuccess = resultModal?.success;
          setResultModal(null);
          if (wasSuccess) navigate("/login");
        }}
      />
    </div>
  );
}
