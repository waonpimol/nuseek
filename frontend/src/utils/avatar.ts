// สีอวาตาร์คำนวณจากชื่อ คนเดิมได้สีเดิมทุกหน้า
export function getAvatarColor(name: string): string {
  if (!name || name === "ผู้ประกาศ") return "hsl(24, 15%, 55%)";

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 45%)`;
}

export function getAvatarInitial(name: string): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || "?";
}