// ถ้า string วันที่จาก backend ไม่มี timezone indicator (Z หรือ +hh:mm) ติดมาด้วย
// ให้ตีความเป็น UTC เสมอ (ป้องกันปัญหา Postgres "timestamp without time zone"
// ที่ไม่แนบ timezone มา แล้ว JS เผลอตีความเป็นเวลาท้องถิ่นของเบราว์เซอร์แทน ทำให้เวลาคลาดเคลื่อน)
function parseAsUtc(dateString: string): Date {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(dateString);
  return new Date(hasTimezone ? dateString : `${dateString}Z`);
}

export function formatRelativeTime(dateString: string): string {
  const date = parseAsUtc(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} วันที่แล้ว`;

  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth} เดือนที่แล้ว`;
}

export function formatFullDate(dateString: string): string {
  const date = parseAsUtc(dateString);
  return date.toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}