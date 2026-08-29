// สูตรคำนวณสีอวาตาร์กลาง ใช้ร่วมกันทุกหน้า (Profile, PostDetail, Allposts, ฯลฯ)
// เพื่อให้คนคนเดียวกัน (ชื่อเดียวกัน) ได้สีอวาตาร์ตรงกันทุกที่ที่โผล่ในแอป
// ก่อนหน้านี้แต่ละหน้ามีสูตรของตัวเอง เลยได้สีไม่ตรงกัน
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