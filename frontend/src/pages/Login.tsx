import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { isValidEmail, translateAuthError } from "../utils/validation";
import ResultModal from "../components/ResultModal";

export default function Login() {
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-cream flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-5 sm:p-8">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-500 rounded-2xl flex items-center justify-center">
            <LogIn className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-xl sm:text-3xl font-semibold text-orange-500 mt-3 sm:mt-5">
          เข้าสู่ระบบ
        </h1>

        <p className="text-center text-gray-500 text-xs sm:text-base mt-1.5 sm:mt-2 mb-5 sm:mb-8">
          ยินดีต้อนรับกลับสู่ NUSeek
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-3.5 sm:space-y-5">

          {/* Email */}
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
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">รหัสผ่าน</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-11 sm:pr-12 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
              />

              {/* ปุ่มเปิด-ปิดตา */}
              <button
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="text-right mt-1.5 sm:mt-2">
              <Link
                to="/forgot-password" 
                className="text-orange-500 hover:underline text-xs sm:text-sm"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center my-5 sm:my-8">
          <div className="flex-1 border-t"></div>
          <span className="mx-4 text-gray-400 text-xs sm:text-sm">หรือ</span>
          <div className="flex-1 border-t"></div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm sm:text-base">
          ยังไม่มีบัญชี?
          <Link
            to="/signup"
            className="text-orange-500 font-semibold ml-2 hover:underline"
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