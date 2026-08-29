import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, Eye, EyeOff } from "lucide-react";
import { supabase } from "../services/supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setEmailError("");
    setPasswordError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;

      navigate("/");
    } catch (error: any) {
      const message = (error.message as string) || "";

      if (message.toLowerCase().includes("email not confirmed")) {
        setEmailError("อีเมลนี้ยังไม่ได้ยืนยัน กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ");
      } else if (message.toLowerCase().includes("invalid login credentials")) {
        setPasswordError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      } else {
        setPasswordError(message || "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F6F3] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center">
            <LogIn className="text-white w-8 h-8" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-center text-3xl font-semibold text-orange-500 mt-5">
          เข้าสู่ระบบ
        </h1>

        <p className="text-center text-gray-500 mt-2 mb-8">
          ยินดีต้อนรับกลับสู่ NUSeek
        </p>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block mb-2 text-gray-600">อีเมล</label>
            <div className="relative">
              <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                placeholder="example@email.com"
                className={`w-full rounded-xl border py-3 pl-12 pr-4 outline-none focus:ring-2 disabled:bg-gray-100 ${
                  emailError
                    ? "border-red-400 focus:ring-red-300"
                    : "border-gray-300 focus:ring-orange-400"
                }`}
              />
            </div>
            {emailError && (
              <p className="text-red-500 text-sm mt-1.5">{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block mb-2 text-gray-600">รหัสผ่าน</label>
            <div className="relative">
              <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                placeholder="********"
                className={`w-full rounded-xl border py-3 pl-12 pr-12 outline-none focus:ring-2 disabled:bg-gray-100 ${
                  passwordError
                    ? "border-red-400 focus:ring-red-300"
                    : "border-gray-300 focus:ring-orange-400"
                }`}
              />

              {/* ปุ่มเปิด-ปิดตา */}
              <button
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-500 text-sm mt-1.5">{passwordError}</p>
            )}

            <div className="text-right mt-2">
              <Link
                to="/forgot-password" 
                className="text-orange-500 hover:underline text-sm"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center my-8">
          <div className="flex-1 border-t"></div>
          <span className="mx-4 text-gray-400 text-sm">หรือ</span>
          <div className="flex-1 border-t"></div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600">
          ยังไม่มีบัญชี?
          <Link
            to="/signup"
            className="text-orange-500 font-semibold ml-2 hover:underline"
          >
            สมัครสมาชิก
          </Link>
        </p>

      </div>
    </div>
  );
}