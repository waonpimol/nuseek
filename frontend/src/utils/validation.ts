// เช็ครูปแบบอีเมลแบบสมเหตุสมผล (เข้มกว่า type="email" ของ HTML เฉยๆ)
// ครอบคลุม: มี @ หนึ่งตัว, มีโดเมนที่มีจุด, ไม่มีช่องว่าง, ไม่ขึ้นต้น/ลงท้ายด้วยจุด
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export interface PasswordCheck {
  label: string;
  passed: boolean;
}

// เช็คความยากของรหัสผ่านทีละเงื่อนไข ใช้ทั้งแสดง checklist แบบ real-time และเช็คตอน submit
export function getPasswordChecks(password: string): PasswordCheck[] {
  return [
    { label: "ยาวอย่างน้อย 8 ตัวอักษร", passed: password.length >= 8 },
    { label: "มีตัวอักษร (a-z, A-Z)", passed: /[A-Za-z]/.test(password) },
    { label: "มีตัวเลข (0-9)", passed: /[0-9]/.test(password) },
  ];
}

export function isPasswordStrong(password: string): boolean {
  return getPasswordChecks(password).every((c) => c.passed);
}

// แปล error message ดิบจาก Supabase Auth (ภาษาอังกฤษ) ให้เป็นข้อความไทยที่ผู้ใช้เข้าใจง่าย
// เทียบจากข้อความบางส่วน เพราะ Supabase ไม่มี error code ที่เสถียรให้ใช้เทียบตรงๆ ทุกกรณี
export function translateAuthError(message: string): string {
  const msg = message.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง";
  }
  if (msg.includes("email not confirmed")) {
    return "อีเมลนี้ยังไม่ได้ยืนยัน กรุณาตรวจสอบกล่องจดหมายเพื่อยืนยันอีเมลก่อนเข้าสู่ระบบ";
  }
  if (msg.includes("user already registered") || msg.includes("already registered")) {
    return "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบแทน หรือใช้อีเมลอื่นในการสมัคร";
  }
  if (msg.includes("password should be at least")) {
    return "รหัสผ่านสั้นเกินไป กรุณาตั้งรหัสผ่านให้ยาวขึ้น";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "พยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง";
  }

  // ไม่เข้าเงื่อนไขไหนเลย ให้ข้อความทั่วไปแทนการโชว์ error ภาษาอังกฤษดิบๆ
  return "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}