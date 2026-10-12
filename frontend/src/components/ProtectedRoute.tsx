import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import PageLoader from "./PageLoader";

// ถ้ายังไม่ login จะเด้งไปหน้า Welcome
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
      <PageLoader fullScreen />
    );
  }

  if (!authenticated) {
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}