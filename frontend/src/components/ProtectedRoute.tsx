import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";

// ครอบทุกหน้าที่บังคับให้ต้อง login ก่อนถึงจะเข้าได้
// ถ้ายังไม่ login จะเด้งไปหน้า Welcome (เลือกเข้าสู่ระบบ/สมัครสมาชิก) แทน
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthenticated(!!data.session);
      setChecking(false);
    });

    // เผื่อ session หมดอายุ/logout จากแท็บอื่นระหว่างใช้งานอยู่
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 font-kanit">
        กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}