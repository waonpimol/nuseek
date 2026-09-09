import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Check,
  X,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "../services/supabaseClient";
import { isValidEmail, getPasswordChecks, isPasswordStrong } from "../utils/validation";

export default function Signup() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordChecks = getPasswordChecks(password);

  const handleSignup = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!isValidEmail(email)) {
      alert("กรุณากรอกอีเมลให้ถูกต้อง เช่น example@email.com");
      return;
    }

    if (!isPasswordStrong(password)) {
      alert("รหัสผ่านยังไม่ปลอดภัยพอ กรุณาทำตามเงื่อนไขที่แสดงไว้ใต้ช่องรหัสผ่านให้ครบ");
      return;
    }

    if (password !== confirmPassword) {
      alert("รหัสผ่านไม่ตรงกัน");
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

        alert("สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลยืนยัน (หากเปิดใช้งาน)");
        navigate("/login");
      }
    } catch (error: any) {
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-3 sm:px-4 py-6 sm:py-10">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-5 sm:p-8">

        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-orange-500 flex items-center justify-center">
            <UserPlus className="text-white w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </div>

        <h1 className="text-center text-xl sm:text-3xl font-semibold text-orange-500 mt-3 sm:mt-5">
          สมัครสมาชิก
        </h1>

        <p className="text-center text-gray-500 text-xs sm:text-base mt-1.5 sm:mt-2 mb-5 sm:mb-8">
          สร้างบัญชีเพื่อใช้งาน NUSeek
        </p>

        <form onSubmit={handleSignup} className="space-y-3.5 sm:space-y-5">

          {/* Name */}
          <div>
            <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">ชื่อ-นามสกุล</label>
            <div className="relative">
              <User size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                required
                disabled={loading}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
              />
            </div>
          </div>

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
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-4 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
                placeholder="example@email.com"
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
                onFocus={() => setPasswordFocused(true)}
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-11 sm:pr-12 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
              />
              <button
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
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
            <label className="block mb-1.5 sm:mb-2 text-sm sm:text-base text-gray-600">ยืนยันรหัสผ่าน</label>
            <div className="relative">
              <Check size={18} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={loading}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-gray-300 py-2.5 sm:py-3 pl-11 sm:pl-12 pr-11 sm:pr-12 text-sm sm:text-base outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-100"
              />
              <button
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 sm:py-3 text-sm sm:text-base rounded-xl font-semibold transition disabled:bg-gray-400"
          >
            {loading ? "กำลังลงทะเบียน..." : "สมัครสมาชิก"}
          </button>

        </form>

        {/* Divider */}
        <div className="flex items-center my-5 sm:my-8">
          <div className="flex-1 border-t"></div>
          <span className="mx-4 text-gray-400 text-xs sm:text-sm">หรือ</span>
          <div className="flex-1 border-t"></div>
        </div>

        <p className="text-center text-gray-500 text-xs sm:text-sm">
          มีบัญชีอยู่แล้ว?
          <Link
            to="/login"
            className="text-orange-500 font-semibold ml-2 hover:underline"
          >
            เข้าสู่ระบบ
          </Link>
        </p>

      </div>
    </div>
  );
}