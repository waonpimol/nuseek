import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Mail, Lock, LogIn, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { isValidEmail, translateAuthError } from "../utils/validation";
import ResultModal from "../components/ResultModal";
import Spinner from "../components/Spinner";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // ย้อนกลับ: ถ้าเข้าหน้านี้มาจากการกดลิงก์ในแอป ก็ถอยกลับหน้าเดิม
  // แต่ถ้าเปิดหน้านี้ตรงๆ (key เป็น "default" ไม่มีหน้าก่อนหน้าในแอป) ให้ไปหน้า Welcome แทน
  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/welcome");
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resultModal, setResultModal] = useState<{ success: boolean; message: string } | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setResultModal({ success: false, message: "กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com" });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      setResultModal({ success: true, message: "เข้าสู่ระบบสำเร็จ!" });
    } catch (error: any) {
      setResultModal({ success: false, message: translateAuthError(error.message || "") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-screen bg-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">

      {/* พื้นหลัง: แถบโค้งสีส้มอ่อนมุมขวาบน (2 ชั้น ให้ดูมีมิติ) */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 240"
        preserveAspectRatio="none"
        className="pointer-events-none absolute top-0 right-0 w-full max-w-[720px] h-44 sm:h-64"
      >
        <defs>
          <linearGradient id="loginSwooshA" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFE3CC" />
            <stop offset="100%" stopColor="#FFC999" />
          </linearGradient>
        </defs>
        <path d="M110,0 C140,70 235,55 290,105 C335,146 372,160 400,150 L400,0 Z" fill="#FFEFE0" />
        <path d="M170,0 C195,55 270,48 322,92 C358,122 384,128 400,124 L400,0 Z" fill="url(#loginSwooshA)" />
      </svg>

      {/* ปุ่มย้อนกลับ */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="ย้อนกลับ"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 p-2 rounded-full text-gray-800 hover:bg-gray-100 transition"
      >
        <ArrowLeft size={22} />
      </button>

      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl p-4 sm:p-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#FF6B00] rounded-2xl flex items-center justify-center">
            <LogIn className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-lg sm:text-2xl font-semibold mt-2.5 sm:mt-4">
          <span className="text-[#FF6B00]">เข้า</span>
          <span className="text-gray-900">สู่ระบบ</span>
        </h1>

        <p className="text-center text-gray-500 text-xs sm:text-sm mt-1 sm:mt-1.5 mb-4 sm:mb-6">
          ยินดีต้อนรับกลับสู่ NUSeek
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4">

          {/* Email */}
          <div>
            <label className="block mb-1 sm:mb-1.5 text-xs sm:text-sm text-gray-600">อีเมล</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1 sm:mb-1.5 text-xs sm:text-sm text-gray-600">รหัสผ่าน</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-10 sm:pr-11 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />

              {/* ปุ่มเปิด-ปิดตา */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="text-right mt-1 sm:mt-1.5">
              <Link
                to="/forgot-password"
                className="text-[#FF6B00] hover:underline text-xs sm:text-sm"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2 sm:py-2.5 text-sm rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? (<><Spinner size={16} />กำลังเข้าสู่ระบบ...</>) : "เข้าสู่ระบบ"}
          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center my-4 sm:my-6">
          <div className="flex-1 border-t"></div>
          <span className="mx-4 text-gray-400 text-xs sm:text-sm">หรือ</span>
          <div className="flex-1 border-t"></div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs sm:text-sm">
          ยังไม่มีบัญชี?
          <Link
            to="/signup"
            className="text-[#FF6B00] font-semibold ml-2 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </p>

      </div>

      <ResultModal
        open={!!resultModal}
        success={resultModal?.success ?? true}
        title={resultModal?.success ? "เข้าสู่ระบบสำเร็จ" : "เข้าสู่ระบบไม่สำเร็จ"}
        message={resultModal?.message || ""}
        onConfirm={() => {
          const wasSuccess = resultModal?.success;
          setResultModal(null);
          if (wasSuccess) navigate("/");
        }}
      />
    </div>
  );
}