import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Check,
  X,
  Eye,
  EyeOff,
  ArrowLeft
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { isValidEmail, getPasswordChecks, isPasswordStrong } from "../utils/validation";
import ResultModal from "../components/ResultModal";
import Spinner from "../components/Spinner";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  // ย้อนกลับ: มาจากหน้าอื่นในแอปก็ถอยกลับหน้าเดิม / เปิดหน้านี้ตรงๆ ให้ไปหน้า Welcome
  const handleBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate("/welcome");
  };
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  // แจ้งผลลัพธ์ต่างๆ ด้วย modal ในแอปเอง แทน alert() ของเบราว์เซอร์ ที่โชว์ "localhost บอกว่า..."
  const [resultModal, setResultModal] = useState<{ success: boolean; message: string; goToLogin?: boolean } | null>(null);

  const passwordChecks = getPasswordChecks(password);

  const handleSignup = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      setResultModal({ success: false, message: "กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com" });
      return;
    }

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
      // 1. สมัครบัญชีเข้าระบบ Authentication ของ Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (authError) throw authError;

      if (authData?.user) {
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // 2. นำข้อมูลโปรไฟล์ไปบันทึกเพิ่มลงตาราง public.users ที่สร้างไว้
        const { error: profileError } = await supabase
          .from("users")
          .insert([
            {
              id: authData.user.id,
              email: email,
              first_name: firstName,
              last_name: lastName,
              display_name: fullName,
            },
          ]);

        if (profileError) throw profileError;

        setResultModal({ success: true, message: "สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลยืนยัน (หากเปิดใช้งาน)", goToLogin: true });
      }
    } catch (error: any) {
      setResultModal({ success: false, message: "เกิดข้อผิดพลาด: " + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden min-h-screen bg-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">

      {/* พื้นหลัง (ธีมเดียวกับหน้า Login แต่คนละลาย): คลื่นพีชบางๆ ชั้นเดียวที่ชายล่างจอ แค่แซมให้ไม่โล่ง */}
      <svg
        aria-hidden="true"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        className="pointer-events-none absolute bottom-0 left-0 w-full h-20 sm:h-32"
      >
        <defs>
          <linearGradient id="signupWaveA" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFE3CC" />
            <stop offset="100%" stopColor="#FFF3E8" />
          </linearGradient>
        </defs>
        <path d="M0,125 C90,85 170,155 260,122 C330,98 370,82 400,94 L400,200 L0,200 Z" fill="url(#signupWaveA)" />
      </svg>

      {/* ปุ่มย้อนกลับ */}
      <button
        type="button"
        onClick={handleBack}
        aria-label="ย้อนกลับ"
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 p-2 rounded-full text-gray-800 hover:bg-white/70 transition"
      >
        <ArrowLeft size={22} />
      </button>

      <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl shadow-xl p-4 sm:p-6">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#FF6B00] flex items-center justify-center">
            <UserPlus className="text-white w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>

        <h1 className="text-center text-lg sm:text-2xl font-semibold mt-2.5 sm:mt-4">
          <span className="text-[#FF6B00]">สมัคร</span>
          <span className="text-gray-900">สมาชิก</span>
        </h1>

        <p className="text-center text-gray-500 text-xs sm:text-sm mt-1 sm:mt-1.5 mb-4 sm:mb-6">
          สร้างบัญชีเพื่อใช้งาน NUSeek
        </p>

        <form onSubmit={handleSignup} className="space-y-3 sm:space-y-4">

          {/* Name */}
          <div>
            <label className="block mb-1 sm:mb-1.5 text-xs sm:text-sm text-gray-600">ชื่อ-นามสกุล</label>
            <div className="relative">
              <User size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
            </div>
          </div>

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
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
                placeholder="example@email.com"
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
                onFocus={() => setPasswordFocused(true)}
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-10 sm:pr-11 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>

            </div>

            {/* Checklist ความยากของรหัสผ่าน แสดงแบบ real-time หลังผู้ใช้เริ่มพิมพ์/โฟกัสช่องนี้ */}
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

          {/* Confirm Password */}
          <div>
            <label className="block mb-1 sm:mb-1.5 text-xs sm:text-sm text-gray-600">ยืนยันรหัสผ่าน</label>
            <div className="relative">
              <Check size={16} className="absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2 sm:py-2.5 pl-10 sm:pl-11 pr-10 sm:pr-11 text-sm outline-none focus:ring-2 focus:ring-[#FF6B00] disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 sm:right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FF6B00] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#E65F00] text-white py-2 sm:py-2.5 text-sm rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? (<><Spinner size={16} />กำลังลงทะเบียน...</>) : "สมัครสมาชิก"}
          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center my-4 sm:my-6">
          <div className="flex-1 border-t"></div>
          <span className="mx-4 text-gray-400 text-xs sm:text-sm">หรือ</span>
          <div className="flex-1 border-t"></div>
        </div>

        <p className="text-center text-gray-500 text-xs sm:text-sm">
          มีบัญชีอยู่แล้ว?
          <Link
            to="/login"
            className="text-[#FF6B00] font-semibold ml-2 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </p>

      </div>

      <ResultModal
        open={!!resultModal}
        success={resultModal?.success ?? true}
        title={resultModal?.success ? "สมัครสมาชิกสำเร็จ" : "เกิดข้อผิดพลาด"}
        message={resultModal?.message || ""}
        confirmLabel="ตกลง"
        onConfirm={() => {
          const shouldGoToLogin = resultModal?.goToLogin;
          setResultModal(null);
          if (shouldGoToLogin) navigate("/login");
        }}
      />
    </div>
  );
}